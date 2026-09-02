import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import {
  checkReportEligibility,
  releaseReviewReservation,
  startCreditReview,
} from './reviewLifecycle.js';

describe('Sprint 6.1 Review eligibility and reservation lifecycle', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint61-${randomUUID()}`;
  let prisma: PrismaClient;
  let actorId: string;
  let clientId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: 'Review', lastName: 'Proof', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    actorId = user.id;
    clientId = user.client!.id;
    await prisma.reviewCreditTransaction.create({
      data: {
        clientId,
        sourceKey: `${marker}:purchase`,
        transactionType: 'PURCHASE',
        availableDelta: 2,
        reason: 'Sprint 6.1 acceptance setup',
        authorizedByUserId: actorId,
      },
    });
    await prisma.creditReview.create({
      data: {
        clientId,
        status: 'COMPLETE',
        completedAt: new Date('2026-07-15T12:00:00Z'),
        intake: { create: { reportDate: new Date('2026-07-01T00:00:00Z') } },
      },
    });
  });

  afterAll(async () => {
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.reviewCreditTransaction.deleteMany({ where: { clientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'CreditReview' } });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: clientId } });
    await prisma.reviewIntake.deleteMany({ where: { review: { clientId } } });
    await prisma.creditReview.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { email: `${marker}@example.test` } });
    await prisma.$disconnect();
  });

  test('newest intended report is eligible while same or older reports are blocked', async () => {
    const newer = await checkReportEligibility(prisma, clientId, new Date('2026-07-02T00:00:00Z'));
    const same = await checkReportEligibility(prisma, clientId, new Date('2026-07-01T00:00:00Z'));
    const older = await checkReportEligibility(prisma, clientId, new Date('2026-06-30T00:00:00Z'));
    expect(newer.state).toBe('ELIGIBLE');
    expect(same.state).toBe('BLOCKED_OLDER_OR_SAME');
    expect(older.state).toBe('BLOCKED_OLDER_OR_SAME');
  });

  test('start reserves exactly one credit and replay creates no duplicate effects', async () => {
    const input = {
      clientId,
      actorId,
      intendedReportDate: new Date('2026-08-01T00:00:00Z'),
      idempotencyKey: `${marker}:start`,
    };
    const first = await startCreditReview(prisma, input);
    const replay = await startCreditReview(prisma, input);
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    const reviewId = first.result.reviewId;
    const balance = await checkReportEligibility(prisma, clientId, input.intendedReportDate);
    expect(balance.state).toBe('ACTIVE_REVIEW');
    expect(balance.credits).toMatchObject({ available: 1, reserved: 1, consumed: 0 });
    await expect(
      prisma.reviewCreditTransaction.count({ where: { reviewId, transactionType: 'RESERVE' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { entityId: reviewId, action: 'CREDIT_REVIEW_STARTED_WITH_RESERVATION' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({
        where: { eventKey: `credit-review-start:${input.idempotencyKey}` },
      }),
    ).resolves.toBe(1);

    const releaseInput = {
      clientId,
      actorId,
      reviewId,
      idempotencyKey: `${marker}:cancel`,
    };
    await releaseReviewReservation(prisma, releaseInput);
    await releaseReviewReservation(prisma, releaseInput);
    const released = await checkReportEligibility(prisma, clientId, input.intendedReportDate);
    expect(released.credits).toMatchObject({ available: 2, reserved: 0, consumed: 0 });
    await expect(
      prisma.reviewCreditTransaction.count({
        where: { reviewId, transactionType: 'RELEASE_RESERVATION' },
      }),
    ).resolves.toBe(1);
  });

  test('concurrent starts cannot overspend or create two active Reviews', async () => {
    const date = new Date('2026-08-15T00:00:00Z');
    const results = await Promise.allSettled([
      startCreditReview(prisma, {
        clientId,
        actorId,
        intendedReportDate: date,
        idempotencyKey: `${marker}:race-a`,
      }),
      startCreditReview(prisma, {
        clientId,
        actorId,
        intendedReportDate: date,
        idempotencyKey: `${marker}:race-b`,
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expect(
      prisma.creditReview.count({
        where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
      }),
    ).resolves.toBe(1);
    const balance = await checkReportEligibility(prisma, clientId, date);
    expect(balance.credits).toMatchObject({ available: 1, reserved: 1, consumed: 0 });
  });
});
