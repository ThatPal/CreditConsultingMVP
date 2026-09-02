import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { deriveReviewCreditBalance } from '../commerce/domain.js';

export type ReportEligibility = {
  state: 'ELIGIBLE' | 'BLOCKED_OLDER_OR_SAME' | 'ACTIVE_REVIEW' | 'PURCHASE_REQUIRED';
  eligible: boolean;
  reason: string;
  intendedReportDate: string;
  latestAcceptedReportDate: string | null;
  activeReviewId: string | null;
  credits: { available: number; reserved: number; consumed: number; expired: number };
  nextPath: string;
};

type StartCreditReviewResult = Prisma.InputJsonObject & {
  reviewId: string;
  reservationTransactionId: string;
  intendedReportDate: string;
};

type ReleaseReviewReservationResult = Prisma.InputJsonObject & {
  reviewId: string;
  released: boolean;
};

const day = (value: Date) => value.toISOString().slice(0, 10);

export async function checkReportEligibility(
  prisma: PrismaClient,
  clientId: string,
  intendedReportDate: Date,
): Promise<ReportEligibility> {
  const [active, latestAccepted, entries, duePlan] = await Promise.all([
    prisma.creditReview.findFirst({
      where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.reviewIntake.findFirst({
      where: { reportDate: { not: null }, review: { clientId, status: 'COMPLETE' } },
      orderBy: { reportDate: 'desc' },
      select: { reportDate: true },
    }),
    prisma.reviewCreditTransaction.findMany({
      where: { clientId },
      select: {
        availableDelta: true,
        reservedDelta: true,
        consumedDelta: true,
        expiredDelta: true,
      },
    }),
    prisma.reviewPlan.findFirst({
      where: {
        clientId,
        status: 'ACTIVE',
        OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }],
      },
      select: { id: true },
    }),
  ]);
  const credits = deriveReviewCreditBalance(entries);
  if (credits.available < 1 && duePlan) credits.available = 1;
  const latestDate = latestAccepted?.reportDate ?? null;
  const base = {
    intendedReportDate: day(intendedReportDate),
    latestAcceptedReportDate: latestDate ? day(latestDate) : null,
    activeReviewId: active?.id ?? null,
    credits,
  };
  if (active)
    return {
      ...base,
      state: 'ACTIVE_REVIEW',
      eligible: false,
      reason: 'Resume the Review already in progress; a second Review was not created.',
      nextPath: '/app/credit-center/review',
    };
  if (latestDate && intendedReportDate <= latestDate)
    return {
      ...base,
      state: 'BLOCKED_OLDER_OR_SAME',
      eligible: false,
      reason: `Use a report newer than ${day(latestDate)}. Monthly timing is guidance, not a separate eligibility rule.`,
      nextPath: '/app/credit-center',
    };
  if (credits.available < 1)
    return {
      ...base,
      state: 'PURCHASE_REQUIRED',
      eligible: false,
      reason: 'One available Review Credit is required to begin.',
      nextPath: '/app/services',
    };
  return {
    ...base,
    state: 'ELIGIBLE',
    eligible: true,
    reason: latestDate
      ? 'This report is newer than the latest accepted report.'
      : 'No accepted report exists yet, so this report can begin the first Review.',
    nextPath: '/app/credit-center/review',
  };
}

export async function startCreditReview(
  prisma: PrismaClient,
  input: { clientId: string; actorId: string; intendedReportDate: Date; idempotencyKey: string },
) {
  const requestHash = createHash('sha256')
    .update(`${input.clientId}:${day(input.intendedReportDate)}`)
    .digest('hex');
  return executeConsequentialCommand<StartCreditReviewResult>(prisma, {
    idempotency: {
      scope: 'credit-review',
      subjectId: input.clientId,
      operation: 'start',
      key: input.idempotencyKey,
      requestHash,
    },
    audit: (result) => ({
      clientId: input.clientId,
      actorId: input.actorId,
      action: 'CREDIT_REVIEW_STARTED_WITH_RESERVATION',
      entityType: 'CreditReview',
      entityId: result.reviewId as string,
      metadata: { intendedReportDate: day(input.intendedReportDate) },
    }),
    outbox: {
      eventType: 'credit_review.started',
      eventKey: `credit-review-start:${input.idempotencyKey}`,
      aggregateType: 'CreditReview',
      aggregateId: (result) => result.reviewId as string,
      payload: (result) => ({
        clientId: input.clientId,
        reviewId: result.reviewId,
        domains: ['review', 'services', 'journey'],
      }),
    },
    mutate: async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.clientId}))`;
      const eligibility = await checkReportEligibility(
        tx as unknown as PrismaClient,
        input.clientId,
        input.intendedReportDate,
      );
      if (eligibility.state === 'ACTIVE_REVIEW')
        throw new AppError('REVIEW_ALREADY_ACTIVE', 409, eligibility.reason);
      if (eligibility.state === 'BLOCKED_OLDER_OR_SAME')
        throw new AppError('REPORT_NOT_NEWER', 409, eligibility.reason);
      if (eligibility.state === 'PURCHASE_REQUIRED')
        throw new AppError('REVIEW_CREDIT_REQUIRED', 409, eligibility.reason);

      const durableEntries = await tx.reviewCreditTransaction.findMany({
        where: { clientId: input.clientId },
        select: {
          availableDelta: true,
          reservedDelta: true,
          consumedDelta: true,
          expiredDelta: true,
        },
      });
      if (deriveReviewCreditBalance(durableEntries).available < 1) {
        const plan = await tx.reviewPlan.findFirst({
          where: {
            clientId: input.clientId,
            status: 'ACTIVE',
            OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: new Date() } }],
          },
        });
        if (!plan)
          throw new AppError('REVIEW_CREDIT_REQUIRED', 409, 'One Review Credit is required');
        await tx.reviewCreditTransaction.create({
          data: {
            clientId: input.clientId,
            sourceKey: `review-plan:${plan.id}:${plan.nextReviewAt?.toISOString() ?? 'initial'}`,
            correlationId: input.idempotencyKey,
            transactionType: 'PURCHASE',
            availableDelta: 1,
            reason: 'Review Credit issued from an active due Review Plan',
            authorizedByUserId: input.actorId,
          },
        });
      }

      const review = await tx.creditReview.create({
        data: {
          clientId: input.clientId,
          intendedReportDate: input.intendedReportDate,
          status: 'INTAKE_REQUIRED',
          intake: { create: {} },
        },
      });
      const reservation = await tx.reviewCreditTransaction.create({
        data: {
          clientId: input.clientId,
          reviewId: review.id,
          sourceKey: `review:${review.id}:reservation`,
          correlationId: input.idempotencyKey,
          transactionType: 'RESERVE',
          availableDelta: -1,
          reservedDelta: 1,
          reason: 'Reserved for an in-progress Credit Review',
          authorizedByUserId: input.actorId,
        },
      });
      await tx.workItem.create({
        data: {
          clientId: input.clientId,
          title: 'Complete Credit Profile Review intake',
          domain: 'CREDIT_REVIEW',
          priority: 'HIGH',
          suggestedNextAction: 'Upload the intended report and complete the Review intake',
          sourceType: 'CreditReview',
          sourceId: review.id,
        },
      });
      return {
        reviewId: review.id,
        reservationTransactionId: reservation.id,
        intendedReportDate: day(input.intendedReportDate),
      } satisfies StartCreditReviewResult;
    },
  });
}

export async function releaseReviewReservation(
  prisma: PrismaClient,
  input: { clientId: string; actorId: string; reviewId: string; idempotencyKey: string },
) {
  return executeConsequentialCommand<ReleaseReviewReservationResult>(prisma, {
    idempotency: {
      scope: 'credit-review',
      subjectId: input.clientId,
      operation: `cancel:${input.reviewId}`,
      key: input.idempotencyKey,
    },
    audit: {
      clientId: input.clientId,
      actorId: input.actorId,
      action: 'CREDIT_REVIEW_CANCELLED_RESERVATION_RELEASED',
      entityType: 'CreditReview',
      entityId: input.reviewId,
    },
    outbox: {
      eventType: 'credit_review.cancelled',
      eventKey: `credit-review-cancel:${input.idempotencyKey}`,
      aggregateType: 'CreditReview',
      aggregateId: input.reviewId,
      payload: {
        clientId: input.clientId,
        reviewId: input.reviewId,
        domains: ['review', 'services'],
      },
    },
    mutate: async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.reviewId}))`;
      const review = await tx.creditReview.findFirst({
        where: {
          id: input.reviewId,
          clientId: input.clientId,
          status: { notIn: ['COMPLETE', 'CANCELLED'] },
        },
      });
      if (!review) throw new AppError('NOT_FOUND', 404, 'Active Review was not found');
      const entries = await tx.reviewCreditTransaction.findMany({
        where: { reviewId: input.reviewId },
        select: { reservedDelta: true },
      });
      const reserved = entries.reduce((sum, entry) => sum + entry.reservedDelta, 0);
      if (reserved !== 1)
        throw new AppError(
          'RESERVATION_INVALID',
          409,
          'The Review does not have one active reservation',
        );
      await tx.reviewCreditTransaction.create({
        data: {
          clientId: input.clientId,
          reviewId: input.reviewId,
          sourceKey: `review:${input.reviewId}:reservation-release`,
          correlationId: input.idempotencyKey,
          transactionType: 'RELEASE_RESERVATION',
          availableDelta: 1,
          reservedDelta: -1,
          reason: 'Released after Review cancellation',
          authorizedByUserId: input.actorId,
        },
      });
      await tx.creditReview.update({
        where: { id: input.reviewId },
        data: { status: 'CANCELLED' },
      });
      await tx.workItem.updateMany({
        where: { sourceType: 'CreditReview', sourceId: input.reviewId, completedAt: null },
        data: { completedAt: new Date() },
      });
      return { reviewId: input.reviewId, released: true };
    },
  });
}
