import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

type SubmissionResult = Prisma.InputJsonObject & {
  reviewId: string;
  status: string;
  consumptionTransactionId: string;
  attentionItemId: string;
};

export async function submitCreditReview(
  prisma: PrismaClient,
  input: {
    clientId: string;
    actorId: string;
    reviewId: string;
    idempotencyKey: string;
    failAfterEffectsForTest?: boolean;
  },
) {
  return executeConsequentialCommand<SubmissionResult>(prisma, {
    idempotency: {
      scope: 'credit-review',
      subjectId: input.clientId,
      operation: `submit:${input.reviewId}`,
      key: input.idempotencyKey,
      requestHash: createHash('sha256').update(`${input.clientId}:${input.reviewId}`).digest('hex'),
    },
    audit: (result) => ({
      clientId: input.clientId,
      actorId: input.actorId,
      action: 'CREDIT_REVIEW_SUBMITTED_CREDIT_CONSUMED',
      entityType: 'CreditReview',
      entityId: result.reviewId,
      metadata: { consumptionTransactionId: result.consumptionTransactionId },
    }),
    outbox: {
      eventType: 'credit_review.submitted',
      eventKey: `credit-review-submitted:${input.reviewId}`,
      aggregateType: 'CreditReview',
      aggregateId: input.reviewId,
      payload: {
        clientId: input.clientId,
        reviewId: input.reviewId,
        domains: ['review', 'services', 'journey', 'attention', 'notifications'],
      },
    },
    mutate: async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.reviewId}))`;
      const current = await tx.creditReview.findFirst({
        where: {
          id: input.reviewId,
          clientId: input.clientId,
          status: { in: ['INTAKE_REQUIRED', 'INFORMATION_REQUESTED'] },
        },
        include: {
          client: { select: { userId: true } },
          intake: { include: { reportDocument: true } },
          clientUpdates: { where: { supersededAt: null } },
          reviewCreditTransactions: true,
        },
      });
      if (!current?.intake)
        throw new AppError('REVIEW_NOT_SUBMITTABLE', 409, 'The Review is not available to submit');
      const intake = current.intake;
      if (!intake.reportDocument || intake.reportDocument.validationStatus !== 'VALIDATED')
        throw new AppError(
          'REVIEW_INTAKE_INCOMPLETE',
          409,
          'A validated credit report is required',
        );
      if (!intake.reportSource || !intake.reportDate)
        throw new AppError('REVIEW_INTAKE_INCOMPLETE', 409, 'Report source and date are required');
      if (!Array.isArray(intake.materialChanges) || intake.materialChanges.length === 0)
        throw new AppError('REVIEW_INTAKE_INCOMPLETE', 409, 'Confirm changes since the report');
      if (intake.creditAccountsConfirmed == null)
        throw new AppError('REVIEW_INTAKE_INCOMPLETE', 409, 'Confirm the complete card portfolio');

      const cards = await tx.clientCard.findMany({
        where: { clientId: input.clientId },
        select: { id: true, updatedAt: true },
        orderBy: { id: 'asc' },
      });
      const reviewedCardIds = new Set(
        Array.isArray(intake.creditAccountReviews)
          ? intake.creditAccountReviews.flatMap((item) =>
              typeof item === 'object' &&
              item !== null &&
              'cardId' in item &&
              typeof item.cardId === 'string'
                ? [item.cardId]
                : [],
            )
          : [],
      );
      if (cards.some((card) => !reviewedCardIds.has(card.id)))
        throw new AppError('REVIEW_INTAKE_INCOMPLETE', 409, 'Review every card in the portfolio');

      const reserved = current.reviewCreditTransactions.reduce(
        (sum, entry) => sum + entry.reservedDelta,
        0,
      );
      if (reserved !== 1)
        throw new AppError(
          'REVIEW_RESERVATION_INVALID',
          409,
          'Exactly one reserved Review Credit is required',
        );
      if (!current.client.userId)
        throw new AppError('CLIENT_IDENTITY_REQUIRED', 409, 'Client identity is required');

      const sourceSnapshot = {
        version: 1,
        intake: { id: intake.id, updatedAt: intake.updatedAt.toISOString() },
        report: {
          id: intake.reportDocument.id,
          sha256: intake.reportDocument.sha256,
          reportDate: intake.reportDocument.reportDateEntered?.toISOString() ?? null,
        },
        cards: cards.map((card) => ({ id: card.id, updatedAt: card.updatedAt.toISOString() })),
        clientUpdates: current.clientUpdates.map((update) => ({
          id: update.id,
          sourceKey: update.sourceKey,
          createdAt: update.createdAt.toISOString(),
        })),
      } satisfies Prisma.InputJsonObject;
      const now = new Date();
      await tx.reviewIntake.update({
        where: { reviewId: input.reviewId },
        data: {
          clientConfirmedAt: now,
          submittedAt: now,
          ...(current.status === 'INFORMATION_REQUESTED' ? { informationResolvedAt: now } : {}),
        },
      });
      await tx.creditReportDocument.update({
        where: { id: intake.reportDocument.id },
        data: { validationStatus: 'ACCEPTED' },
      });
      await tx.creditReview.update({
        where: { id: input.reviewId },
        data: {
          status: 'INFORMATION_RECEIVED',
          generalReadiness: 'UNDER_REVIEW',
          submittedAt: now,
          submittedSourceSnapshot: sourceSnapshot,
        },
      });
      const consumption = await tx.reviewCreditTransaction.create({
        data: {
          clientId: input.clientId,
          reviewId: input.reviewId,
          sourceKey: `review:${input.reviewId}:consumption`,
          correlationId: input.idempotencyKey,
          transactionType: 'CONSUME',
          reservedDelta: -1,
          consumedDelta: 1,
          reason: 'Consumed when complete Review intake was submitted',
          authorizedByUserId: input.actorId,
        },
      });
      await tx.workItem.updateMany({
        where: {
          clientId: input.clientId,
          sourceType: 'CreditReview',
          sourceId: input.reviewId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        data: { status: 'COMPLETED', completedAt: now, resolvedAt: now },
      });
      const attention = await tx.workItem.create({
        data: {
          clientId: input.clientId,
          title: 'Review submitted Credit Profile',
          domain: 'CREDIT_REVIEW',
          priority: 'HIGH',
          authority: 'ATTENTION_PROJECTION',
          sourceType: 'CreditReview',
          sourceId: input.reviewId,
          reasonCode: 'CREDIT_REVIEW_SUBMITTED',
          dedupeKey: `credit-review:${input.reviewId}:submitted`,
          deepLink: {
            type: 'CREDIT_REVIEW',
            route: '/crm/reviews',
            params: { reviewId: input.reviewId },
          },
          neededSince: now,
          suggestedNextAction: 'Open the submitted Review workspace',
        },
      });
      await tx.notification.create({
        data: {
          userId: current.client.userId,
          clientId: input.clientId,
          semanticKey: `credit-review:${input.reviewId}:submitted`,
          type: 'CREDIT_REVIEW_SUBMITTED',
          category: 'REVIEW',
          title: 'Your Credit Review was submitted',
          body: 'Your information is queued for consultant review.',
          link: '/app/credit-center/review',
          safePayload: { reviewId: input.reviewId },
        },
      });
      if (input.failAfterEffectsForTest) throw new Error('TEST_SUBMISSION_FAILURE');
      return {
        reviewId: input.reviewId,
        status: 'INFORMATION_RECEIVED',
        consumptionTransactionId: consumption.id,
        attentionItemId: attention.id,
      };
    },
  });
}
