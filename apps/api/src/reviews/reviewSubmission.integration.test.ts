import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { submitCreditReview } from './reviewSubmission.js';

describe('Sprint 6.5 atomic Review submission', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint65-${randomUUID()}`;
  let prisma: PrismaClient;
  let actorId: string;
  let clientId: string;
  let reviewId: string;
  let documentId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: 'Submit', lastName: 'Proof', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    actorId = user.id;
    clientId = user.client!.id;
    const document = await prisma.creditReportDocument.create({
      data: {
        storageKey: `proof/${marker}.pdf`,
        originalFileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 30,
        sha256: 'a'.repeat(64),
        provider: 'Experian',
        sourceEntered: 'Experian',
        reportDate: new Date('2026-08-20T00:00:00Z'),
        reportDateEntered: new Date('2026-08-20T00:00:00Z'),
        validationStatus: 'VALIDATED',
        uploadedByUserId: actorId,
      },
    });
    documentId = document.id;
    const review = await prisma.creditReview.create({
      data: {
        clientId,
        status: 'INTAKE_REQUIRED',
        intendedReportDate: new Date('2026-08-20T00:00:00Z'),
        intake: {
          create: {
            reportDocumentId: document.id,
            reportDocumentKey: document.storageKey,
            reportSource: 'Experian',
            reportDate: new Date('2026-08-20T00:00:00Z'),
            materialChanges: [],
            creditAccountsConfirmed: true,
            creditAccountReviews: [],
          },
        },
      },
    });
    reviewId = review.id;
    await prisma.reviewCreditTransaction.createMany({
      data: [
        {
          clientId,
          sourceKey: `${marker}:purchase`,
          transactionType: 'PURCHASE',
          availableDelta: 1,
          reason: 'Submission proof credit',
        },
        {
          clientId,
          reviewId,
          sourceKey: `review:${reviewId}:reservation`,
          transactionType: 'RESERVE',
          availableDelta: -1,
          reservedDelta: 1,
          reason: 'Submission proof reservation',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.notification.deleteMany({ where: { clientId } });
    await prisma.reviewCreditTransaction.deleteMany({ where: { clientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: reviewId } });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: clientId } });
    await prisma.reviewIntake.deleteMany({ where: { reviewId } });
    await prisma.creditReview.deleteMany({ where: { id: reviewId } });
    await prisma.creditReportDocument.deleteMany({ where: { id: documentId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { email: `${marker}@example.test` } });
    await prisma.$disconnect();
  });

  test('incomplete and injected-failure attempts consume zero, then retry commits exactly once', async () => {
    const idempotencyKey = `${marker}:submit`;
    await expect(
      submitCreditReview(prisma, { clientId, actorId, reviewId, idempotencyKey }),
    ).rejects.toMatchObject({ code: 'REVIEW_INTAKE_INCOMPLETE' });
    await expect(
      prisma.reviewCreditTransaction.count({ where: { reviewId, transactionType: 'CONSUME' } }),
    ).resolves.toBe(0);

    await prisma.reviewIntake.update({
      where: { reviewId },
      data: { materialChanges: ['No material changes'], noChangesConfirmedAt: new Date() },
    });
    await expect(
      submitCreditReview(prisma, {
        clientId,
        actorId,
        reviewId,
        idempotencyKey,
        failAfterEffectsForTest: true,
      }),
    ).rejects.toThrow('TEST_SUBMISSION_FAILURE');
    await expect(
      prisma.reviewCreditTransaction.count({ where: { reviewId, transactionType: 'CONSUME' } }),
    ).resolves.toBe(0);
    await expect(
      prisma.creditReview.findUnique({ where: { id: reviewId } }),
    ).resolves.toMatchObject({
      status: 'INTAKE_REQUIRED',
      submittedSourceSnapshot: null,
    });

    const first = await submitCreditReview(prisma, {
      clientId,
      actorId,
      reviewId,
      idempotencyKey,
    });
    const replay = await submitCreditReview(prisma, {
      clientId,
      actorId,
      reviewId,
      idempotencyKey,
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    await expect(
      prisma.reviewCreditTransaction.count({ where: { reviewId, transactionType: 'CONSUME' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { entityId: reviewId, action: 'CREDIT_REVIEW_SUBMITTED_CREDIT_CONSUMED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `credit-review-submitted:${reviewId}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.findUnique({ where: { eventKey: `credit-review-submitted:${reviewId}` } }),
    ).resolves.toMatchObject({ status: 'PENDING', publishedAt: null, attemptCount: 0 });
    await expect(
      prisma.notification.count({ where: { semanticKey: `credit-review:${reviewId}:submitted` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.workItem.count({ where: { dedupeKey: `credit-review:${reviewId}:submitted` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.creditReview.findUnique({ where: { id: reviewId } }),
    ).resolves.toMatchObject({
      status: 'INFORMATION_RECEIVED',
      submittedSourceSnapshot: expect.objectContaining({ version: 1 }),
    });
    await expect(
      prisma.creditReportDocument.findUnique({ where: { id: documentId } }),
    ).resolves.toMatchObject({ validationStatus: 'ACCEPTED' });
  });

  test('different concurrent keys still produce one consumption and submission', async () => {
    const raceMarker = `${marker}-race`;
    const user = await prisma.user.create({
      data: {
        email: `${raceMarker}@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: 'Race', lastName: 'Proof', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    const raceClientId = user.client!.id;
    const document = await prisma.creditReportDocument.create({
      data: {
        storageKey: `proof/${raceMarker}.pdf`,
        originalFileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 30,
        sha256: 'b'.repeat(64),
        sourceEntered: 'Experian',
        reportDateEntered: new Date('2026-08-22T00:00:00Z'),
        validationStatus: 'VALIDATED',
        uploadedByUserId: user.id,
      },
    });
    const review = await prisma.creditReview.create({
      data: {
        clientId: raceClientId,
        status: 'INTAKE_REQUIRED',
        intake: {
          create: {
            reportDocumentId: document.id,
            reportDocumentKey: document.storageKey,
            reportSource: 'Experian',
            reportDate: new Date('2026-08-22T00:00:00Z'),
            materialChanges: ['No material changes'],
            noChangesConfirmedAt: new Date(),
            creditAccountsConfirmed: true,
            creditAccountReviews: [],
          },
        },
      },
    });
    await prisma.reviewCreditTransaction.createMany({
      data: [
        {
          clientId: raceClientId,
          sourceKey: `${raceMarker}:purchase`,
          transactionType: 'PURCHASE',
          availableDelta: 1,
          reason: 'Race proof credit',
        },
        {
          clientId: raceClientId,
          reviewId: review.id,
          sourceKey: `review:${review.id}:reservation`,
          transactionType: 'RESERVE',
          availableDelta: -1,
          reservedDelta: 1,
          reason: 'Race proof reservation',
        },
      ],
    });
    const results = await Promise.allSettled([
      submitCreditReview(prisma, {
        clientId: raceClientId,
        actorId: user.id,
        reviewId: review.id,
        idempotencyKey: `${raceMarker}:a`,
      }),
      submitCreditReview(prisma, {
        clientId: raceClientId,
        actorId: user.id,
        reviewId: review.id,
        idempotencyKey: `${raceMarker}:b`,
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    await expect(
      prisma.reviewCreditTransaction.count({
        where: { reviewId: review.id, transactionType: 'CONSUME' },
      }),
    ).resolves.toBe(1);

    await prisma.workItem.deleteMany({ where: { clientId: raceClientId } });
    await prisma.notification.deleteMany({ where: { clientId: raceClientId } });
    await prisma.reviewCreditTransaction.deleteMany({ where: { clientId: raceClientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId: raceClientId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: review.id } });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: raceClientId } });
    await prisma.reviewIntake.delete({ where: { reviewId: review.id } });
    await prisma.creditReview.delete({ where: { id: review.id } });
    await prisma.creditReportDocument.delete({ where: { id: document.id } });
    await prisma.client.delete({ where: { id: raceClientId } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
