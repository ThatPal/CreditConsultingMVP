import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/authService.js';
import { requireAuth, requireClientAccess, requireRole } from '../auth/middleware.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate } from '../liveUpdates.js';
import { createLocalDocumentStorage, type DocumentStorage } from '../storage/documentStorage.js';

const startSchema = z.object({ purchaseId: z.string().uuid().optional() });
const creditAccountReviewSchema = z.object({
  cardId: z.string().uuid().optional(),
  status: z.enum(['CONFIRMED', 'UPDATED', 'NEW']),
  cardName: z.string().trim().min(1).max(160),
  issuer: z.string().trim().min(1).max(160),
  scope: z.enum(['PERSONAL', 'BUSINESS']),
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
  router.post('/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(startSchema, req.body);
      const clientId = req.auth!.clientId!;
      const review = await prisma.$transaction(async (tx) => {
        const active = await tx.creditReview.findFirst({
          where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
        });
        if (active)
          throw new AppError(
            'REVIEW_ALREADY_ACTIVE',
            409,
            'A Credit Profile Review is already active',
          );
        const purchaseId: string | null = input.purchaseId ?? null;
        if (purchaseId) {
          const purchase = await tx.servicePurchase.findFirst({
            where: {
              id: purchaseId,
              clientId,
              serviceType: 'CREDIT_PROFILE_REVIEW',
              status: 'PAID',
              creditReview: null,
            },
          });
          if (!purchase)
            throw new AppError(
              'REVIEW_ENTITLEMENT_REQUIRED',
              409,
              'A verified unused Credit Profile Review purchase is required',
            );
        } else {
          const plan = await tx.reviewPlan.findFirst({
            where: {
              clientId,
              status: 'ACTIVE',
              OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }],
            },
          });
          if (!plan)
            throw new AppError(
              'REVIEW_ENTITLEMENT_REQUIRED',
              409,
              'Purchase a Review or use an available Review plan entitlement',
            );
        }
        const created = await tx.creditReview.create({
          data: { clientId, purchaseId, status: 'INTAKE_REQUIRED', intake: { create: {} } },
          include: includeReview,
        });
        await tx.workItem.create({
          data: {
            clientId,
            title: 'Complete Credit Profile Review intake',
            domain: 'CREDIT_REVIEW',
            priority: 'HIGH',
            suggestedNextAction: 'Upload report and confirm current information',
          },
        });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action: 'CREDIT_REVIEW_STARTED',
            entityType: 'CreditReview',
            entityId: created.id,
          },
        });
        return created;
      });
      res.status(201).json({ review: present(review) });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/client/:reviewId/report-document',
    requireRole('CLIENT'),
    express.raw({ type: 'application/pdf', limit: '15mb' }),
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
        if (mimeType !== 'application/pdf')
          throw new AppError(
            'REPORT_FILE_TYPE_INVALID',
            415,
            'Only PDF credit reports are accepted',
          );
        const extension = '.pdf';
        const rawName = req.get('x-file-name');
        const originalFileName = rawName
          ? decodeURIComponent(rawName).slice(0, 240)
          : `credit-report${extension}`;
        const documentId = randomUUID();
        const storageKey = `credit-reports/${clientId}/${documentId}${extension}`;
        const stored = await documentStorage.put(storageKey, req.body);
        writtenStorageKey = storageKey;
        const document = await prisma.$transaction(async (tx) => {
          if (review.intake!.reportDocumentId)
            await tx.creditReportDocument.update({
              where: { id: review.intake!.reportDocumentId },
              data: { supersededAt: new Date() },
            });
          const created = await tx.creditReportDocument.create({
            data: {
              id: documentId,
              storageKey,
              originalFileName,
              mimeType,
              sizeBytes: stored.sizeBytes,
              sha256: stored.sha256,
              provider: stored.provider,
              uploadedByUserId: req.auth!.userId,
            },
          });
          await tx.reviewIntake.update({
            where: { reviewId },
            data: { reportDocumentId: created.id, reportDocumentKey: created.storageKey },
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'CREDIT_REPORT_UPLOADED',
              entityType: 'CreditReportDocument',
              entityId: created.id,
              metadata: { reviewId, mimeType, sizeBytes: req.body.length },
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
      });
      if (!review) throw new AppError('NOT_FOUND', 404, 'Active Review intake was not found');
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
      };
      await prisma.$transaction(async (tx) => {
        const intake = await tx.reviewIntake.update({ where: { reviewId }, data });
        if (intake.reportDocumentId && (input.reportSource || input.reportDate))
          await tx.creditReportDocument.update({
            where: { id: intake.reportDocumentId },
            data: {
              ...(input.reportSource ? { provider: input.reportSource } : {}),
              ...(input.reportDate ? { reportDate: input.reportDate } : {}),
            },
          });
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
        if (input.status === 'NEW') {
          const card = await tx.clientCard.create({
            data: {
              clientId,
              cardName: input.cardName,
              issuer: input.issuer,
              scope: input.scope,
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
                accountStatus: input.accountStatus,
                balance: input.balance ?? null,
                creditLimit: input.creditLimit ?? null,
              },
            });
        }

        const savedReview = { ...input, cardId };
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
      const review = await prisma.$transaction(async (tx) => {
        const current = await tx.creditReview.findFirst({
          where: {
            id: reviewId,
            clientId,
            status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
          },
          include: { intake: true },
        });
        if (!current?.intake?.reportDocumentKey || !current.intake.reportDate)
          throw new AppError(
            'REVIEW_INTAKE_INCOMPLETE',
            409,
            'Report upload and report date are required',
          );
        if (
          !Array.isArray(current.intake.materialChanges) ||
          current.intake.materialChanges.length === 0
        )
          throw new AppError(
            'REVIEW_INTAKE_INCOMPLETE',
            409,
            'Confirm whether anything changed after the report date',
          );
        if (current.intake.creditAccountsConfirmed == null)
          throw new AppError(
            'REVIEW_INTAKE_INCOMPLETE',
            409,
            'Review and confirm the credit accounts in your profile',
          );
        if (
          current.intake.creditAccountsConfirmed === false &&
          (!Array.isArray(current.intake.creditAccountReviews) ||
            !current.intake.creditAccountReviews.some(
              (item) =>
                typeof item === 'object' &&
                item !== null &&
                'status' in item &&
                item.status !== 'CONFIRMED',
            ))
        )
          throw new AppError(
            'REVIEW_INTAKE_INCOMPLETE',
            409,
            'Add at least one credit-account change before submitting',
          );
        await tx.reviewIntake.update({
          where: { reviewId },
          data: {
            clientConfirmedAt: new Date(),
            submittedAt: new Date(),
            ...(current.status === 'INFORMATION_REQUESTED'
              ? { informationResolvedAt: new Date() }
              : {}),
          },
        });
        const updated = await tx.creditReview.update({
          where: { id: reviewId },
          data: {
            status: 'INFORMATION_RECEIVED',
            generalReadiness: 'UNDER_REVIEW',
            submittedAt: new Date(),
          },
          include: includeReview,
        });
        await tx.workItem.updateMany({
          where: { clientId, domain: 'CREDIT_REVIEW', status: { in: ['OPEN', 'IN_PROGRESS'] } },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
        await tx.workItem.create({
          data: {
            clientId,
            assigneeId: null,
            title: 'Review submitted Credit Profile',
            domain: 'CREDIT_REVIEW',
            priority: 'HIGH',
            suggestedNextAction: 'Open guided Review workspace',
          },
        });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action: 'CREDIT_REVIEW_SUBMITTED',
            entityType: 'CreditReview',
            entityId: reviewId,
          },
        });
        return updated;
      });
      res.json({ review: present(review) });
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
    requireClientAccess(auth),
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
    '/consultant/:clientId/:reviewId/request-information',
    requireRole('CONSULTANT', 'ADMIN'),
    requireClientAccess(auth),
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
    requireClientAccess(auth),
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
    requireClientAccess(auth),
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
