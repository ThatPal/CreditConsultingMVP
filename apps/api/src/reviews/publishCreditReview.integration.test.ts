import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { publishCreditReview } from './publishCreditReview.js';
describe('Sprint 8.3 immutable publication transaction', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const marker = `s83-${randomUUID()}`;
  let prisma: PrismaClient, clientId: string, clientUserId: string, consultantId: string;
  const reviewIds: string[] = [];
  beforeAll(async () => {
    prisma = createPrisma(url);
    await prisma.$connect();
    const clientUser = await prisma.user.create({
      data: {
        email: `${marker}-client@test.local`,
        role: 'CLIENT',
        client: { create: { firstName: 'Golden', lastName: 'Path', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    clientUserId = clientUser.id;
    clientId = clientUser.client!.id;
    consultantId = (
      await prisma.user.create({
        data: { email: `${marker}-consultant@test.local`, role: 'CONSULTANT' },
      })
    ).id;
  });
  async function ready(suffix: string) {
    const report = await prisma.creditReportDocument.create({
      data: {
        storageKey: `${marker}/${suffix}.pdf`,
        originalFileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 20,
        sha256: suffix.padEnd(64, 'a').slice(0, 64),
        validationStatus: 'ACCEPTED',
        uploadedByUserId: clientUserId,
      },
    });
    const review = await prisma.creditReview.create({
      data: {
        clientId,
        status: 'CONSULTANT_REVIEW',
        consultantId,
        intake: { create: { reportDocumentId: report.id } },
        drafts: {
          create: {
            version: 1,
            sourceVersions: { report: report.sha256, artifacts: ['phase7'] },
            profile: {
              experianScore: 720,
              equifaxScore: 710,
              transunionScore: 715,
              aggregateUtilization: 24,
            },
            analysis: { clientSummary: 'Your profile is improving.' },
            recommendation: {
              outcome: 'PREPARE_FIRST',
              clientExplanation: 'Reduce utilization first.',
              reasons: ['Utilization'],
              approved: true,
              approvedBy: consultantId,
            },
            analysisApprovedAt: new Date(),
            recommendationApprovedAt: new Date(),
            approvedByUserId: consultantId,
            contextVersion: 'context-1',
            createdByUserId: consultantId,
            findings: {
              create: {
                code: 'utilization',
                title: 'Utilization opportunity',
                clientSummary: 'Reducing balances may help.',
                internalDetail: 'private',
                severity: 'CAUTION',
                status: 'APPROVED',
                origin: 'CONSULTANT',
                evidence: [],
                actorId: consultantId,
              },
            },
          },
        },
      },
    });
    reviewIds.push(review.id);
    return review;
  }
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: reviewIds } } });
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: reviewIds } } });
    await prisma.notification.deleteMany({
      where: { semanticKey: { startsWith: 'credit-review-published:' } },
    });
    await prisma.creditReview.updateMany({
      where: { id: { in: reviewIds } },
      data: { snapshotId: null },
    });
    await prisma.publishedCreditReview.deleteMany({ where: { reviewId: { in: reviewIds } } });
    await prisma.creditProfileState.deleteMany({ where: { clientId } });
    await prisma.creditSnapshot.deleteMany({
      where: { clientId, source: 'PUBLISHED_CREDIT_REVIEW' },
    });
    await prisma.creditReview.deleteMany({ where: { id: { in: reviewIds } } });
    await prisma.creditReportDocument.deleteMany({
      where: { storageKey: { startsWith: `${marker}/` } },
    });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, consultantId] } } });
    await prisma.$disconnect();
  });
  test('failure rolls back every publication effect and retry commits exactly once', async () => {
    const review = await ready('rollback');
    const input = {
      reviewId: review.id,
      clientId,
      actorId: consultantId,
      actorRole: 'CONSULTANT',
      idempotencyKey: `${marker}:rollback`,
      expectedDraftVersion: 1,
    };
    await expect(
      publishCreditReview(prisma, { ...input, failAfterSnapshot: true }),
    ).rejects.toThrow('SIMULATED_PUBLICATION_FAILURE');
    expect(await prisma.publishedCreditReview.count({ where: { reviewId: review.id } })).toBe(0);
    expect(
      await prisma.creditSnapshot.count({ where: { clientId, source: 'PUBLISHED_CREDIT_REVIEW' } }),
    ).toBe(0);
    await publishCreditReview(prisma, input);
    await publishCreditReview(prisma, input);
    expect(await prisma.publishedCreditReview.count({ where: { reviewId: review.id } })).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { entityId: review.id, action: 'CREDIT_REVIEW_PUBLISHED' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventKey: `credit-review-published:${review.id}` },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({
        where: { semanticKey: `credit-review-published:${review.id}` },
      }),
    ).toBe(1);
  });
  test('concurrent publication converges and client-safe payload has no internal AI fields', async () => {
    const review = await ready('concurrent');
    const input = {
      reviewId: review.id,
      clientId,
      actorId: consultantId,
      actorRole: 'CONSULTANT',
      idempotencyKey: `${marker}:concurrent`,
      expectedDraftVersion: 1,
    };
    await Promise.allSettled([
      publishCreditReview(prisma, input),
      publishCreditReview(prisma, input),
    ]);
    const rows = await prisma.publishedCreditReview.findMany({ where: { reviewId: review.id } });
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]?.clientSafeProjection)).not.toMatch(
      /private|provider|confidence|aiProvenance|approvedBy/,
    );
  });
  test('blocking, stale, unapproved and unauthorized inputs produce zero effects', async () => {
    const cases = [
      [
        'blocked',
        async (id: string) =>
          prisma.reviewVerificationException.create({
            data: {
              reviewId: id,
              exceptionKey: 'block',
              category: 'TEST',
              summary: 'Block',
              materiality: 'material',
              blocking: true,
              evidence: [],
            },
          }),
      ],
      [
        'stale',
        async (id: string) =>
          prisma.reviewDraft.update({
            where: { reviewId_version: { reviewId: id, version: 1 } },
            data: { sourceVersions: { report: 'different' } },
          }),
      ],
      [
        'unapproved',
        async (id: string) =>
          prisma.reviewDraft.update({
            where: { reviewId_version: { reviewId: id, version: 1 } },
            data: {
              recommendation: {
                outcome: 'PREPARE_FIRST',
                clientExplanation: 'x',
                reasons: [],
                approved: false,
              },
            },
          }),
      ],
    ] as const;
    for (const [name, mutate] of cases) {
      const review = await ready(name);
      await mutate(review.id);
      await expect(
        publishCreditReview(prisma, {
          reviewId: review.id,
          clientId,
          actorId: consultantId,
          actorRole: 'CONSULTANT',
          idempotencyKey: `${marker}:${name}`,
          expectedDraftVersion: 1,
        }),
      ).rejects.toThrow();
      expect(await prisma.publishedCreditReview.count({ where: { reviewId: review.id } })).toBe(0);
      await prisma.creditReview.update({ where: { id: review.id }, data: { status: 'CANCELLED' } });
    }
    const review = await ready('admin');
    await expect(
      publishCreditReview(prisma, {
        reviewId: review.id,
        clientId,
        actorId: consultantId,
        actorRole: 'ADMIN',
        idempotencyKey: `${marker}:admin`,
        expectedDraftVersion: 1,
      }),
    ).rejects.toThrow();
  });
});
