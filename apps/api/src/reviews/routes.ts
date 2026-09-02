import { createHash, randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/authService.js';
import {
  requireAuth,
  requireCapability,
  requireClientAccess,
  requireRole,
} from '../auth/middleware.js';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import {
  createPrismaAuthorizationDenialRecorder,
  createPrismaAuthorizationService,
  type AuthorizationService,
} from '../authorization/authorizationService.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate } from '../liveUpdates.js';
import { createLocalDocumentStorage, type DocumentStorage } from '../storage/documentStorage.js';
import {
  checkReportEligibility,
  releaseReviewReservation,
  startCreditReview,
} from './reviewLifecycle.js';
import { validateCreditReportUpload } from './reportValidation.js';
import { submitCreditReview } from './reviewSubmission.js';

const startSchema = z.object({ intendedReportDate: z.coerce.date() });
const creditAccountReviewSchema = z.object({
  cardId: z.string().uuid().optional(),
  status: z.enum(['CONFIRMED', 'UPDATED', 'NEW']),
  cardName: z.string().trim().min(1).max(160),
  issuer: z.string().trim().min(1).max(160),
  scope: z.enum(['PERSONAL', 'BUSINESS']),
  portfolioType: z
    .enum(['PERSONAL_CREDIT', 'BUSINESS_CREDIT', 'SECURED', 'NON_REPORTING'])
    .optional(),
  identityStatus: z.enum(['CONFIRMED', 'UNRESOLVED']).optional(),
  maskedIdentifier: z
    .string()
    .trim()
    .regex(/^\*{0,4}\d{0,4}$/)
    .max(8)
    .optional(),
  reportsToBureaus: z.boolean().optional(),
  accountStatus: z.enum(['OPEN', 'CLOSED']),
  balance: z.number().min(0).optional(),
  creditLimit: z.number().min(0).optional(),
});
const intakeSchema = z.object({
  reportSource: z.string().trim().min(1).max(100).optional(),
  reportDate: z.coerce.date().optional(),
  recentApplications: z
    .array(
      z.object({
        issuer: z.string().trim().min(1).max(120),
        date: z.string().trim().min(1).max(40),
        outcome: z.enum(['APPROVED', 'PENDING', 'DECLINED', 'ABANDONED']),
        scope: z.enum(['PERSONAL', 'BUSINESS']),
        approvedAmount: z.number().min(0).optional(),
      }),
    )
    .max(30)
    .optional(),
  accountUpdates: z
    .array(
      z.object({
        creditorName: z.string().trim().min(1).max(160),
        changeType: z.enum([
          'NEW_ACCOUNT',
          'BALANCE_CHANGED',
          'LIMIT_CHANGED',
          'ACCOUNT_CLOSED',
          'NOT_MINE',
          'AUTHORIZED_USER_CHANGED',
          'PROMOTIONAL_OFFER_CHANGED',
        ]),
        balance: z.number().min(0).optional(),
        creditLimit: z.number().min(0).optional(),
        effectiveDate: z.string().trim().max(40).optional(),
      }),
    )
    .max(100)
    .optional(),
  creditAccountsConfirmed: z.boolean().optional(),
  creditAccountReviews: z.array(creditAccountReviewSchema).max(100).optional(),
  materialChanges: z.array(z.string().trim().min(1).max(300)).max(30).optional(),
  materialChangeDetails: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(120),
        details: z.string().trim().max(1000),
      }),
    )
    .max(30)
    .optional(),
});
const completionSchema = z
  .object({
    snapshot: z.object({
      capturedAt: z.coerce.date(),
      expiresAt: z.coerce.date(),
      source: z.string().trim().max(100).optional(),
      experianScore: z.number().int().min(300).max(850).optional(),
      equifaxScore: z.number().int().min(300).max(850).optional(),
      transunionScore: z.number().int().min(300).max(850).optional(),
      scoreModel: z.string().trim().max(120).optional(),
      aggregateUtilization: z.number().min(0).max(100).optional(),
      revolvingBalance: z.number().min(0).optional(),
      revolvingLimit: z.number().min(0).optional(),
      openAccounts: z.number().int().min(0).optional(),
      recentInquiries: z.number().int().min(0).optional(),
      derogatoryItems: z.number().int().min(0).optional(),
      averageAccountAgeMonths: z.number().int().min(0).optional(),
      oldestAccountAgeMonths: z.number().int().min(0).optional(),
      revolvingAccounts: z.number().int().min(0).optional(),
      installmentAccounts: z.number().int().min(0).optional(),
      closedAccounts: z.number().int().min(0).optional(),
      latePayments: z.number().int().min(0).optional(),
      collections: z.number().int().min(0).optional(),
      chargeOffs: z.number().int().min(0).optional(),
      bankruptcies: z.number().int().min(0).optional(),
      paymentHistoryStatus: z.string().trim().max(120).optional(),
      accounts: z
        .array(
          z.object({
            creditorName: z.string().trim().min(1).max(160),
            maskedAccountNumber: z.string().trim().max(40).optional(),
            accountType: z.string().trim().min(1).max(80),
            responsibility: z.string().trim().max(80).optional(),
            scope: z.enum(['PERSONAL', 'BUSINESS', 'BOTH']).optional(),
            openedAt: z.coerce.date().optional(),
            creditLimit: z.number().min(0).optional(),
            balance: z.number().min(0).optional(),
            paymentStatus: z.string().max(80).optional(),
            lastReportedAt: z.coerce.date().optional(),
            promotionalAprExpiresAt: z.coerce.date().optional(),
            attentionStatus: z.string().trim().max(120).optional(),
            isOpen: z.boolean().default(true),
          }),
        )
        .max(200)
        .default([]),
    }),
    generalReadiness: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    recommendation: z.enum([
      'PROCEED',
      'PROCEED_SELECTIVELY',
      'PREPARE_FIRST',
      'WAIT_NURTURE',
      'MAJOR_APPLICATION_PRIORITY',
    ]),
    readinessExpiresAt: z.coerce.date(),
    nextReviewRecommendedAt: z.coerce.date().optional(),
    clientSummary: z.string().trim().min(20).max(4000),
    internalNotes: z.string().max(4000).optional(),
    findings: z
      .array(
        z.object({
          optionId: z.string().uuid().optional(),
          code: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(180),
          description: z.string().max(1000).optional(),
          severity: z.enum(['POSITIVE', 'INFORMATIONAL', 'CAUTION', 'CRITICAL']),
        }),
      )
      .min(1)
      .max(50),
    actionOptionIds: z.array(z.string().uuid()).max(30).default([]),
  })
  .superRefine((value, context) => {
    if (value.generalReadiness !== 'HIGH' && value.actionOptionIds.length === 0)
      context.addIssue({
        code: 'custom',
        path: ['actionOptionIds'],
        message: 'Select at least one required action for this decision',
      });
  });
const informationRequestSchema = z.object({
  reasons: z
    .array(
      z.enum([
        'UPDATED_REPORT',
        'MISSING_ACCOUNT',
        'ACCOUNT_DETAILS',
        'RECENT_APPLICATION',
        'IDENTITY_MISMATCH',
        'OTHER',
      ]),
    )
    .min(1)
    .max(10),
  note: z.string().trim().max(1000).optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError('VALIDATION_ERROR', 400, result.error.issues[0]?.message ?? 'Invalid input');
  return result.data;
}
const includeReview = {
  intake: {
    include: {
      reportDocument: {
        select: {
          id: true,
          originalFileName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
        },
      },
    },
  },
  findings: { orderBy: { sortOrder: 'asc' as const } },
  snapshot: { include: { accounts: true } },
  clientUpdates: {
    where: { supersededAt: null },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;
type ReviewWithDetails = Prisma.CreditReviewGetPayload<{ include: typeof includeReview }>;
type ReviewWithOptionalClientSnapshots = ReviewWithDetails & {
  client?: { creditSnapshots?: NonNullable<ReviewWithDetails['snapshot']>[] };
};

function present(review: ReviewWithOptionalClientSnapshots | null) {
  if (!review) return null;
  const normalizeSnapshot = (snapshot: ReviewWithDetails['snapshot']) =>
    snapshot
      ? {
          ...snapshot,
          aggregateUtilization: snapshot.aggregateUtilization?.toNumber() ?? null,
          revolvingBalance: snapshot.revolvingBalance?.toNumber() ?? null,
          revolvingLimit: snapshot.revolvingLimit?.toNumber() ?? null,
          accounts: snapshot.accounts.map((a) => ({
            ...a,
            creditLimit: a.creditLimit?.toNumber() ?? null,
            balance: a.balance?.toNumber() ?? null,
          })),
        }
      : null;
  return {
    ...review,
    snapshot: normalizeSnapshot(review.snapshot),
    ...(review.client?.creditSnapshots
      ? {
          client: {
            ...review.client,
            creditSnapshots: review.client.creditSnapshots.map(normalizeSnapshot),
          },
        }
      : {}),
  };
}

export function createReviewRouter(
  prisma: PrismaClient,
  auth: AuthService,
  documentStorage: DocumentStorage = createLocalDocumentStorage(),
  authorization: AuthorizationService = createPrismaAuthorizationService(prisma),
  denialRecorder: AuthorizationDenialRecorder = createPrismaAuthorizationDenialRecorder(prisma),
) {
  const router = Router();
  router.use(requireAuth);

  router.get('/report-documents/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const documents = await prisma.creditReportDocument.findMany({
        where: { uploadedByUserId: req.auth!.userId },
        orderBy: { uploadedAt: 'desc' },
        select: {
          id: true,
          originalFileName: true,
          mimeType: true,
          sizeBytes: true,
          uploadedAt: true,
          supersededAt: true,
          intake: {
            select: {
              reportSource: true,
              reportDate: true,
              review: { select: { id: true, status: true, completedAt: true } },
            },
          },
        },
      });
      res.json({ documents });
    } catch (error) {
      next(error);
    }
  });

  router.get('/report-documents/:documentId/content', async (req, res, next) => {
    try {
      const documentId = req.params.documentId as string;
      const access =
        req.auth!.role === 'ADMIN'
          ? {}
          : req.auth!.role === 'CLIENT'
            ? { uploadedByUserId: req.auth!.userId }
            : { intake: { review: { client: { assignedConsultantId: req.auth!.userId } } } };
      const document = await prisma.creditReportDocument.findFirst({
        where: { id: documentId, ...access },
      });
      if (!document) throw new AppError('NOT_FOUND', 404, 'Credit report was not found');
      const file = await documentStorage.read(document.storageKey).catch((error: Error) => {
        if (error.message === 'INVALID_STORAGE_KEY')
          throw new AppError('INVALID_STORAGE_KEY', 500, 'Stored report path is invalid', false);
        throw error;
      });
      if (!file)
        throw new AppError('DOCUMENT_FILE_MISSING', 404, 'The stored document file is unavailable');
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(file);
    } catch (error) {
      next(error);
    }
  });

  router.get('/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const review = await prisma.creditReview.findFirst({
        where: { clientId: req.auth!.clientId! },
        orderBy: { createdAt: 'desc' },
        include: includeReview,
      });
      res.json({ review: present(review) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/eligibility', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(z.object({ intendedReportDate: z.coerce.date() }), req.query);
      res.json({
        eligibility: await checkReportEligibility(
          prisma,
          req.auth!.clientId!,
          input.intendedReportDate,
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(startSchema, req.body);
      const idempotencyKey = req.get('idempotency-key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      const started = await startCreditReview(prisma, {
        clientId: req.auth!.clientId!,
        actorId: req.auth!.userId,
        intendedReportDate: input.intendedReportDate,
        idempotencyKey,
      });
      const review = await prisma.creditReview.findUnique({
        where: { id: started.result.reviewId as string },
        include: includeReview,
      });
      res.status(started.replayed ? 200 : 201).json({
        review: present(review),
        reservation: {
          transactionId: started.result.reservationTransactionId,
          consumed: false,
        },
        replayed: started.replayed,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/:reviewId/cancel', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const idempotencyKey = req.get('idempotency-key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      const released = await releaseReviewReservation(prisma, {
        clientId: req.auth!.clientId!,
        actorId: req.auth!.userId,
        reviewId: req.params.reviewId as string,
        idempotencyKey,
      });
      res.json(released);
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/client/:reviewId/report-document',
    requireRole('CLIENT'),
    express.raw({ type: '*/*', limit: '15mb' }),
    async (req, res, next) => {
      let writtenStorageKey: string | null = null;
      try {
        const clientId = req.auth!.clientId!;
        const reviewId = req.params.reviewId as string;
        const review = await prisma.creditReview.findFirst({
          where: {
            id: reviewId,
            clientId,
            status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
          },
          include: { intake: { include: { reportDocument: true } } },
        });
        if (!review?.intake)
          throw new AppError('NOT_FOUND', 404, 'Active Review intake was not found');
        if (!Buffer.isBuffer(req.body) || req.body.length === 0)
          throw new AppError('REPORT_FILE_REQUIRED', 400, 'Select a PDF credit-report file');
        const mimeType = req.get('content-type')?.split(';')[0] ?? '';
        const rawName = req.get('x-file-name');
        const originalFileName = rawName
          ? decodeURIComponent(rawName).slice(0, 240)
          : 'credit-report.pdf';
        const sourceEntered = decodeURIComponent(req.get('x-report-source') ?? '').trim();
        const reportDateHeader = req.get('x-report-date');
        if (!sourceEntered)
          throw new AppError('REPORT_SOURCE_REQUIRED', 400, 'Select the report source');
        if (!reportDateHeader)
          throw new AppError('REPORT_DATE_REQUIRED', 400, 'Enter the report date');
        const reportDateEntered = z.coerce.date().parse(reportDateHeader);
        const latestAccepted = await prisma.reviewIntake.findFirst({
          where: {
            review: { clientId, status: 'COMPLETE', id: { not: reviewId } },
            reportDate: { not: null },
          },
          orderBy: { reportDate: 'desc' },
          select: { reportDate: true },
        });
        const validation = validateCreditReportUpload({
          bytes: req.body,
          mimeType,
          fileName: originalFileName,
          enteredReportDate: reportDateEntered,
          intendedReportDate: review.intendedReportDate ?? reportDateEntered,
          latestAcceptedReportDate: latestAccepted?.reportDate ?? null,
        });
        const extension = '.pdf';
        const documentId = randomUUID();
        const storageKey = `credit-reports/${clientId}/${documentId}${extension}`;
        const stored = await documentStorage.put(storageKey, req.body);
        writtenStorageKey = storageKey;
        const document = await prisma.$transaction(async (tx) => {
          const created = await tx.creditReportDocument.create({
            data: {
              id: documentId,
              storageKey,
              originalFileName,
              mimeType,
              sizeBytes: stored.sizeBytes,
              sha256: stored.sha256,
              provider: sourceEntered,
              storageProvider: stored.provider,
              sourceEntered,
              reportDateEntered,
              reportDate: reportDateEntered,
              validationStatus: validation.status,
              rejectionCode: validation.rejectionCode,
              rejectionReason: validation.rejectionReason,
              uploadedByUserId: req.auth!.userId,
            },
          });
          if (validation.status === 'VALIDATED') {
            if (review.intake!.reportDocumentId)
              await tx.creditReportDocument.update({
                where: { id: review.intake!.reportDocumentId },
                data: { supersededAt: new Date(), supersededById: documentId },
              });
            await tx.reviewIntake.update({
              where: { reviewId },
              data: {
                reportDocumentId: created.id,
                reportDocumentKey: created.storageKey,
                reportSource: sourceEntered,
                reportDate: reportDateEntered,
              },
            });
          }
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action:
                validation.status === 'VALIDATED'
                  ? 'CREDIT_REPORT_VALIDATED'
                  : validation.status === 'NEEDS_STAFF_REVIEW'
                    ? 'CREDIT_REPORT_STAFF_REVIEW_REQUIRED'
                    : 'CREDIT_REPORT_REJECTED',
              entityType: 'CreditReportDocument',
              entityId: created.id,
              metadata: {
                reviewId,
                mimeType,
                sizeBytes: req.body.length,
                validationStatus: validation.status,
                rejectionCode: validation.rejectionCode,
              },
            },
          });
          return created;
        });
        res.status(201).json({
          document: {
            id: document.id,
            originalFileName,
            mimeType,
            sizeBytes: document.sizeBytes,
            validationStatus: document.validationStatus,
            rejectionCode: document.rejectionCode,
            rejectionReason: document.rejectionReason,
          },
        });
      } catch (error) {
        if (writtenStorageKey)
          await documentStorage.delete(writtenStorageKey).catch(() => undefined);
        next(error);
      }
    },
  );
  router.patch('/client/:reviewId/intake', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(intakeSchema, req.body);
      const clientId = req.auth!.clientId!;
      const reviewId = req.params.reviewId as string;
      const review = await prisma.creditReview.findFirst({
        where: {
          id: reviewId,
          clientId,
          status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
        },
        include: { intake: { include: { reportDocument: true } } },
      });
      if (!review) throw new AppError('NOT_FOUND', 404, 'Active Review intake was not found');
      const reportDocument = review.intake?.reportDocument;
      if (
        reportDocument &&
        ((input.reportSource !== undefined &&
          input.reportSource !== reportDocument.sourceEntered) ||
          (input.reportDate !== undefined &&
            input.reportDate.toISOString().slice(0, 10) !==
              reportDocument.reportDateEntered?.toISOString().slice(0, 10)))
      )
        throw new AppError(
          'REPORT_METADATA_IMMUTABLE',
          409,
          'Upload a replacement report to change its source or report date',
        );
      const data = {
        ...(input.reportSource !== undefined ? { reportSource: input.reportSource } : {}),
        ...(input.reportDate !== undefined ? { reportDate: input.reportDate } : {}),
        ...(input.recentApplications !== undefined
          ? { recentApplications: input.recentApplications }
          : {}),
        ...(input.accountUpdates !== undefined ? { accountUpdates: input.accountUpdates } : {}),
        ...(input.creditAccountsConfirmed !== undefined
          ? { creditAccountsConfirmed: input.creditAccountsConfirmed }
          : {}),
        ...(input.creditAccountReviews !== undefined
          ? { creditAccountReviews: input.creditAccountReviews }
          : {}),
        ...(input.materialChanges !== undefined ? { materialChanges: input.materialChanges } : {}),
        ...(input.materialChangeDetails !== undefined
          ? { materialChangeDetails: input.materialChangeDetails }
          : {}),
        ...(input.materialChanges !== undefined
          ? {
              noChangesConfirmedAt: input.materialChanges.includes('No material changes')
                ? new Date()
                : null,
            }
          : {}),
      };
      await prisma.$transaction(async (tx) => {
        await tx.reviewIntake.update({ where: { reviewId }, data });
        if (
          input.accountUpdates === undefined &&
          input.materialChangeDetails === undefined &&
          input.recentApplications === undefined
        )
          return;
        const declarations = [
          ...(input.accountUpdates ?? []).map((update) => ({
            category: update.changeType,
            subject: update.creditorName,
            details: JSON.stringify({
              ...(update.balance !== undefined ? { balance: update.balance } : {}),
              ...(update.creditLimit !== undefined ? { creditLimit: update.creditLimit } : {}),
            }),
            effectiveDate:
              update.effectiveDate && !Number.isNaN(Date.parse(update.effectiveDate))
                ? new Date(update.effectiveDate)
                : null,
            provenance: { entry: 'review-intake', field: 'accountUpdates' },
          })),
          ...(input.materialChangeDetails ?? []).map((change) => ({
            category: 'OTHER' as const,
            subject: change.type,
            details: change.details,
            effectiveDate: null,
            provenance: { entry: 'review-intake', field: 'materialChangeDetails' },
          })),
          ...(input.recentApplications ?? []).map((application) => ({
            category: 'RECENT_APPLICATION' as const,
            subject: application.issuer,
            details: JSON.stringify({
              outcome: application.outcome,
              scope: application.scope,
              ...(application.approvedAmount !== undefined
                ? { approvedAmount: application.approvedAmount }
                : {}),
            }),
            effectiveDate: !Number.isNaN(Date.parse(application.date))
              ? new Date(application.date)
              : null,
            provenance: { entry: 'review-intake', field: 'recentApplications' },
          })),
        ];
        const keys = declarations.map((declaration) =>
          createHash('sha256').update(JSON.stringify(declaration)).digest('hex'),
        );
        await tx.clientUpdate.updateMany({
          where: {
            reviewId,
            source: 'CLIENT_DECLARED',
            supersededAt: null,
            ...(keys.length ? { sourceKey: { notIn: keys } } : {}),
          },
          data: { supersededAt: new Date() },
        });
        await Promise.all(
          declarations.map((declaration, index) =>
            tx.clientUpdate.upsert({
              where: { reviewId_sourceKey: { reviewId, sourceKey: keys[index]! } },
              create: {
                clientId,
                reviewId,
                sourceKey: keys[index]!,
                source: 'CLIENT_DECLARED',
                ...declaration,
              },
              update: { ...declaration, supersededAt: null },
            }),
          ),
        );
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/:reviewId/card-review', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(creditAccountReviewSchema, req.body);
      const clientId = req.auth!.clientId!;
      const reviewId = req.params.reviewId as string;
      const result = await prisma.$transaction(async (tx) => {
        const review = await tx.creditReview.findFirst({
          where: {
            id: reviewId,
            clientId,
            status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
          },
          include: { intake: true },
        });
        if (!review?.intake)
          throw new AppError('NOT_FOUND', 404, 'Active Review intake was not found');

        let cardId = input.cardId;
        let duplicateWarnings: string[] = [];
        if (input.status === 'NEW') {
          const candidates = await tx.clientCard.findMany({
            where: {
              clientId,
              OR: [
                { issuer: { equals: input.issuer, mode: 'insensitive' } },
                { cardName: { equals: input.cardName, mode: 'insensitive' } },
              ],
            },
            select: { id: true, issuer: true, cardName: true, accountStatus: true },
            take: 5,
          });
          duplicateWarnings = candidates.map(
            (candidate) =>
              `${candidate.issuer} ${candidate.cardName} (${candidate.accountStatus ?? 'status unknown'}) may be the same account.`,
          );
          const card = await tx.clientCard.create({
            data: {
              clientId,
              cardName: input.cardName,
              issuer: input.issuer,
              scope: input.scope,
              portfolioType:
                input.portfolioType ??
                (input.scope === 'BUSINESS' ? 'BUSINESS_CREDIT' : 'PERSONAL_CREDIT'),
              identityStatus: input.identityStatus ?? 'CONFIRMED',
              ...(input.maskedIdentifier !== undefined
                ? { maskedIdentifier: input.maskedIdentifier }
                : {}),
              ...(input.reportsToBureaus !== undefined
                ? { reportsToBureaus: input.reportsToBureaus }
                : {}),
              accountStatus: input.accountStatus,
              ...(input.balance !== undefined ? { balance: input.balance } : {}),
              ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
            },
          });
          cardId = card.id;
        } else {
          if (!cardId) throw new AppError('CARD_REQUIRED', 400, 'Select the card being reviewed');
          const existing = await tx.clientCard.findFirst({ where: { id: cardId, clientId } });
          if (!existing) throw new AppError('NOT_FOUND', 404, 'Credit card was not found');
          if (input.status === 'UPDATED')
            await tx.clientCard.update({
              where: { id: cardId },
              data: {
                cardName: input.cardName,
                issuer: input.issuer,
                scope: input.scope,
                portfolioType:
                  input.portfolioType ??
                  (input.scope === 'BUSINESS' ? 'BUSINESS_CREDIT' : 'PERSONAL_CREDIT'),
                identityStatus: input.identityStatus ?? 'CONFIRMED',
                maskedIdentifier: input.maskedIdentifier ?? null,
                reportsToBureaus: input.reportsToBureaus ?? null,
                accountStatus: input.accountStatus,
                balance: input.balance ?? null,
                creditLimit: input.creditLimit ?? null,
              },
            });
        }

        const savedReview = { ...input, cardId, duplicateWarnings };
        const priorReviews = Array.isArray(review.intake.creditAccountReviews)
          ? review.intake.creditAccountReviews
          : [];
        const creditAccountReviews = [
          ...priorReviews.filter(
            (item) =>
              typeof item !== 'object' ||
              item === null ||
              !('cardId' in item) ||
              item.cardId !== cardId,
          ),
          savedReview,
        ];
        await tx.reviewIntake.update({
          where: { reviewId },
          data: { creditAccountReviews },
        });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action:
              input.status === 'CONFIRMED'
                ? 'CREDIT_CARD_CONFIRMED'
                : input.status === 'NEW'
                  ? 'CREDIT_CARD_ADDED_DURING_REVIEW'
                  : 'CREDIT_CARD_UPDATED_DURING_REVIEW',
            entityType: 'ClientCard',
            entityId: cardId,
            metadata: { reviewId },
          },
        });
        return savedReview;
      });
      res.json({ cardReview: result });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/:reviewId/submit', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const reviewId = req.params.reviewId as string;
      const idempotencyKey = req.get('idempotency-key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      const submitted = await submitCreditReview(prisma, {
        clientId,
        actorId: req.auth!.userId,
        reviewId,
        idempotencyKey,
      });
      const review = await prisma.creditReview.findUnique({
        where: { id: reviewId },
        include: includeReview,
      });
      res.json({ review: present(review), replayed: submitted.replayed });
    } catch (error) {
      next(error);
    }
  });

  router.get('/consultant', requireRole('CONSULTANT', 'ADMIN'), async (req, res, next) => {
    try {
      const reviews = await prisma.creditReview.findMany({
        where:
          req.auth!.role === 'ADMIN'
            ? { status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] } }
            : {
                status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] },
                client: { assignedConsultantId: req.auth!.userId },
              },
        include: { client: { select: { firstName: true, lastName: true } }, intake: true },
        orderBy: { submittedAt: 'asc' },
        take: 100,
      });
      res.json({ reviews });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/:clientId/:reviewId',
    requireRole('CONSULTANT', 'ADMIN'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        const review = await prisma.creditReview.findFirst({
          where: { id: req.params.reviewId as string, clientId: req.params.clientId as string },
          include: {
            ...includeReview,
            client: {
              include: {
                goals: true,
                creditSnapshots: {
                  orderBy: { capturedAt: 'desc' },
                  take: 2,
                  include: { accounts: true },
                },
              },
            },
          },
        });
        if (!review) throw new AppError('NOT_FOUND', 404, 'Credit Profile Review was not found');
        res.json({ review: present(review) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/:clientId/:reviewId/report-document/:documentId/decision',
    requireRole('CONSULTANT', 'ADMIN'),
    requireCapability(authorization, 'review.publish', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const input = parse(
          z.object({
            decision: z.enum(['ACCEPT', 'REJECT']),
            reason: z.string().trim().min(1).max(500).optional(),
          }),
          req.body,
        );
        const clientId = req.params.clientId as string;
        const reviewId = req.params.reviewId as string;
        const documentId = req.params.documentId as string;
        const document = await prisma.$transaction(async (tx) => {
          const review = await tx.creditReview.findFirst({
            where: {
              id: reviewId,
              clientId,
              status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
            },
            include: { intake: true, client: { select: { userId: true } } },
          });
          if (!review?.intake)
            throw new AppError('NOT_FOUND', 404, 'Active Review intake was not found');
          if (!review.client.userId)
            throw new AppError(
              'REPORT_OWNER_INVALID',
              409,
              'The client report owner is unavailable',
            );
          const candidate = await tx.creditReportDocument.findFirst({
            where: { id: documentId, uploadedByUserId: review.client.userId },
          });
          if (!candidate || candidate.validationStatus !== 'NEEDS_STAFF_REVIEW')
            throw new AppError(
              'REPORT_DECISION_NOT_AVAILABLE',
              409,
              'Report is not awaiting staff review',
            );
          if (input.decision === 'ACCEPT') {
            if (review.intake.reportDocumentId)
              await tx.creditReportDocument.update({
                where: { id: review.intake.reportDocumentId },
                data: { supersededAt: new Date(), supersededById: candidate.id },
              });
            await tx.reviewIntake.update({
              where: { reviewId },
              data: {
                reportDocumentId: candidate.id,
                reportDocumentKey: candidate.storageKey,
                reportSource: candidate.sourceEntered,
                reportDate: candidate.reportDateEntered,
              },
            });
          }
          const updated = await tx.creditReportDocument.update({
            where: { id: candidate.id },
            data:
              input.decision === 'ACCEPT'
                ? { validationStatus: 'VALIDATED', rejectionCode: null, rejectionReason: null }
                : {
                    validationStatus: 'REJECTED',
                    rejectionCode: 'STAFF_REJECTED',
                    rejectionReason: input.reason ?? 'Staff rejected the report after review.',
                  },
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action:
                input.decision === 'ACCEPT'
                  ? 'CREDIT_REPORT_STAFF_ACCEPTED'
                  : 'CREDIT_REPORT_STAFF_REJECTED',
              entityType: 'CreditReportDocument',
              entityId: candidate.id,
              metadata: { reviewId, reason: input.reason ?? null },
            },
          });
          return updated;
        });
        res.json({ document });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/:clientId/:reviewId/request-information',
    requireRole('CONSULTANT', 'ADMIN'),
    requireCapability(authorization, 'review.publish', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const input = parse(informationRequestSchema, req.body);
        const clientId = req.params.clientId as string;
        const reviewId = req.params.reviewId as string;
        const review = await prisma.$transaction(async (tx) => {
          const existing = await tx.creditReview.findFirst({
            where: {
              id: reviewId,
              clientId,
              status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] },
            },
            include: { intake: true },
          });
          if (!existing)
            throw new AppError(
              'REVIEW_NOT_AVAILABLE',
              409,
              'Review is not available for an information request',
            );
          await tx.reviewIntake.update({
            where: { reviewId },
            data: {
              informationRequest: input,
              informationRequestedAt: new Date(),
              informationResolvedAt: null,
            },
          });
          const updated = await tx.creditReview.update({
            where: { id: reviewId },
            data: { status: 'INFORMATION_REQUESTED' },
            include: includeReview,
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'CREDIT_REVIEW_INFORMATION_REQUESTED',
              entityType: 'CreditReview',
              entityId: reviewId,
              metadata: input,
            },
          });
          return updated;
        });
        publishLiveUpdate(clientId, 'review', 'application-cycles');
        res.json({ review: present(review) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/:clientId/:reviewId/start',
    requireRole('CONSULTANT', 'ADMIN'),
    requireCapability(authorization, 'review.publish', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const clientId = req.params.clientId as string;
        const reviewId = req.params.reviewId as string;
        const review = await prisma.$transaction(async (tx) => {
          const existing = await tx.creditReview.findFirst({
            where: { id: reviewId, clientId, status: 'INFORMATION_RECEIVED' },
          });
          if (!existing)
            throw new AppError('REVIEW_NOT_READY_TO_START', 409, 'Review is not ready to start');
          const updated = await tx.creditReview.update({
            where: { id: reviewId },
            data: {
              status: 'CONSULTANT_REVIEW',
              consultantId: req.auth!.userId,
              reviewStartedAt: new Date(),
            },
            include: includeReview,
          });
          await tx.workItem.updateMany({
            where: { clientId, domain: 'CREDIT_REVIEW', status: 'OPEN' },
            data: { status: 'IN_PROGRESS', assigneeId: req.auth!.userId },
          });
          const activeCycle = await tx.applicationCycle.findFirst({
            where: { clientId, status: 'ACTIVE', currentStage: 'CREDIT_REVIEW' },
            include: { steps: true },
          });
          const reviewStep = activeCycle?.steps.find((step) => step.stage === 'CREDIT_REVIEW');
          if (reviewStep)
            await tx.applicationCycleStep.update({
              where: { id: reviewStep.id },
              data: {
                status: 'IN_PROGRESS',
                startedAt: reviewStep.startedAt ?? new Date(),
                sourceType: 'CreditReview',
                sourceId: reviewId,
              },
            });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'CREDIT_REVIEW_CONSULTANT_STARTED',
              entityType: 'CreditReview',
              entityId: reviewId,
            },
          });
          return updated;
        });
        publishLiveUpdate(clientId, 'review', 'application-cycles');
        res.json({ review: present(review) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/:clientId/:reviewId/complete',
    requireRole('CONSULTANT', 'ADMIN'),
    requireCapability(
      authorization,
      'review.publish',
      'clientId',
      { requireStepUp: true },
      denialRecorder,
    ),
    async (req, res, next) => {
      try {
        const input = parse(completionSchema, req.body);
        const clientId = req.params.clientId as string;
        const reviewId = req.params.reviewId as string;
        const completed = await prisma.$transaction(async (tx) => {
          const existing = await tx.creditReview.findFirst({
            where: {
              id: reviewId,
              clientId,
              status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] },
            },
            include: { intake: true },
          });
          if (!existing)
            throw new AppError(
              'REVIEW_NOT_COMPLETABLE',
              409,
              'Review is not available for completion',
            );
          if (!existing.intake?.reportDocumentId)
            throw new AppError(
              'REPORT_DOCUMENT_REQUIRED',
              409,
              'A securely uploaded credit report is required before completion',
            );
          const snapshot = await tx.creditSnapshot.create({
            data: {
              clientId,
              capturedAt: input.snapshot.capturedAt,
              expiresAt: input.snapshot.expiresAt,
              source: input.snapshot.source ?? null,
              experianScore: input.snapshot.experianScore ?? null,
              equifaxScore: input.snapshot.equifaxScore ?? null,
              transunionScore: input.snapshot.transunionScore ?? null,
              scoreModel: input.snapshot.scoreModel ?? null,
              aggregateUtilization: input.snapshot.aggregateUtilization ?? null,
              revolvingBalance: input.snapshot.revolvingBalance ?? null,
              revolvingLimit: input.snapshot.revolvingLimit ?? null,
              openAccounts: input.snapshot.openAccounts ?? null,
              recentInquiries: input.snapshot.recentInquiries ?? null,
              derogatoryItems: input.snapshot.derogatoryItems ?? null,
              averageAccountAgeMonths: input.snapshot.averageAccountAgeMonths ?? null,
              oldestAccountAgeMonths: input.snapshot.oldestAccountAgeMonths ?? null,
              revolvingAccounts: input.snapshot.revolvingAccounts ?? null,
              installmentAccounts: input.snapshot.installmentAccounts ?? null,
              closedAccounts: input.snapshot.closedAccounts ?? null,
              latePayments: input.snapshot.latePayments ?? null,
              collections: input.snapshot.collections ?? null,
              chargeOffs: input.snapshot.chargeOffs ?? null,
              bankruptcies: input.snapshot.bankruptcies ?? null,
              paymentHistoryStatus: input.snapshot.paymentHistoryStatus ?? null,
              accounts: {
                create: input.snapshot.accounts.map((a) => ({
                  creditorName: a.creditorName,
                  maskedAccountNumber: a.maskedAccountNumber ?? null,
                  accountType: a.accountType,
                  responsibility: a.responsibility ?? null,
                  scope: a.scope ?? null,
                  openedAt: a.openedAt ?? null,
                  creditLimit: a.creditLimit ?? null,
                  balance: a.balance ?? null,
                  paymentStatus: a.paymentStatus ?? null,
                  lastReportedAt: a.lastReportedAt ?? null,
                  promotionalAprExpiresAt: a.promotionalAprExpiresAt ?? null,
                  attentionStatus: a.attentionStatus ?? null,
                  isOpen: a.isOpen,
                })),
              },
            },
          });
          await tx.reviewFinding.createMany({
            data: input.findings.map((f, sortOrder) => ({
              reviewId,
              optionId: f.optionId ?? null,
              code: f.code,
              label: f.label,
              description: f.description ?? null,
              severity: f.severity,
              sortOrder,
            })),
          });
          const review = await tx.creditReview.update({
            where: { id: reviewId },
            data: {
              consultantId: req.auth!.userId,
              status: 'COMPLETE',
              generalReadiness: input.generalReadiness,
              recommendation: input.recommendation,
              readinessExpiresAt: input.readinessExpiresAt,
              nextReviewRecommendedAt: input.nextReviewRecommendedAt ?? null,
              clientSummary: input.clientSummary,
              internalNotes: input.internalNotes ?? null,
              snapshotId: snapshot.id,
              completedAt: new Date(),
            },
            include: includeReview,
          });
          const bundles = input.actionOptionIds.length
            ? await tx.optionTemplate.findMany({
                where: { id: { in: input.actionOptionIds }, kind: 'ACTION_BUNDLE', active: true },
              })
            : [];
          for (const [sortOrder, bundle] of bundles.entries())
            await tx.planAction.upsert({
              where: {
                sourceType_sourceId_title: {
                  sourceType: 'CREDIT_REVIEW',
                  sourceId: reviewId,
                  title: bundle.label,
                },
              },
              create: {
                clientId,
                title: bundle.label,
                description: bundle.description,
                owner: 'CLIENT',
                sourceType: 'CREDIT_REVIEW',
                sourceId: reviewId,
                sortOrder,
              },
              update: { description: bundle.description, sortOrder, status: 'READY' },
            });
          await tx.workItem.updateMany({
            where: {
              clientId,
              domain: 'CREDIT_REVIEW',
              status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
          const activeCycle = await tx.applicationCycle.findFirst({
            where: { clientId, status: 'ACTIVE', currentStage: 'CREDIT_REVIEW' },
            include: { steps: true },
          });
          if (activeCycle) {
            const reviewStep = activeCycle.steps.find((step) => step.stage === 'CREDIT_REVIEW');
            const decisionStep = activeCycle.steps.find(
              (step) => step.stage === 'CONSULTANT_DECISION',
            );
            const advancedAt = new Date();
            if (reviewStep)
              await tx.applicationCycleStep.update({
                where: { id: reviewStep.id },
                data: {
                  status: 'COMPLETE',
                  completedAt: advancedAt,
                  sourceType: 'CreditReview',
                  sourceId: reviewId,
                },
              });
            if (decisionStep)
              await tx.applicationCycleStep.update({
                where: { id: decisionStep.id },
                data: {
                  status: 'AVAILABLE',
                  startedAt: decisionStep.startedAt ?? advancedAt,
                  sourceType: 'CreditReview',
                  sourceId: reviewId,
                },
              });
            await tx.applicationCycle.update({
              where: { id: activeCycle.id },
              data: {
                currentStage: 'CONSULTANT_DECISION',
                readinessDecision:
                  input.generalReadiness === 'HIGH'
                    ? 'READY'
                    : input.generalReadiness === 'MEDIUM'
                      ? 'ACTION_REQUIRED'
                      : 'NOT_READY',
              },
            });
          }
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'CREDIT_REVIEW_COMPLETED',
              entityType: 'CreditReview',
              entityId: reviewId,
              metadata: {
                snapshotId: snapshot.id,
                generalReadiness: input.generalReadiness,
                recommendation: input.recommendation,
                actionOptionIds: input.actionOptionIds,
              },
            },
          });
          return review;
        });
        publishLiveUpdate(clientId, 'review', 'application-cycles', 'credit-profile');
        res.json({ review: present(completed) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}

export function createCreditProfileRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth, requireRole('CLIENT'));
  router.get('/', async (req, res, next) => {
    try {
      const [reviews, actions] = await Promise.all([
        prisma.creditReview.findMany({
          where: { clientId: req.auth!.clientId!, status: 'COMPLETE' },
          orderBy: { completedAt: 'desc' },
          include: includeReview,
          take: 24,
        }),
        prisma.planAction.findMany({
          where: { clientId: req.auth!.clientId!, status: { notIn: ['CANCELLED'] } },
          orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 100,
        }),
      ]);
      const review = reviews[0] ?? null;
      const now = new Date();
      const generalReadiness = !review
        ? 'NEEDS_REVIEW'
        : !review.readinessExpiresAt || review.readinessExpiresAt <= now
          ? 'EXPIRED'
          : review.generalReadiness;
      res.json({
        profile: review
          ? {
              review: present(review),
              history: reviews.map(present),
              generalReadiness,
              freshness: {
                asOf: review.snapshot?.capturedAt ?? null,
                expiresAt: review.readinessExpiresAt,
                isCurrent: generalReadiness !== 'EXPIRED',
              },
              actions,
            }
          : {
              review: null,
              history: [],
              generalReadiness,
              freshness: { asOf: null, expiresAt: null, isCurrent: false },
              actions,
            },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
