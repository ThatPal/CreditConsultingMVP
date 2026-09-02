import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { DurableAIRuntime } from '../ai/durableRuntime.js';
import {
  Phase7DeterministicProvider,
  RecordingAIQueue,
  phase7Validators,
  runDurablePhase7Pipeline,
} from '../ai/durableCreditReportPipeline.js';
import { supportedThreeBureauReport } from '../ai/fixtures/syntheticReports.js';
import {
  decidePersistedFinding,
  getOrCreateReviewWorkspace,
  reviewWorkspaceReadiness,
  saveReviewAnalysis,
  saveReviewOverride,
} from './persistedReviewWorkspace.js';
import { publishCreditReview } from './publishCreditReview.js';

describe('persisted CRM-11 workspace and immutable publication application contract', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `checkpoint68-${randomUUID()}`;
  let prisma: PrismaClient;
  let userId: string;
  let consultantId: string;
  let clientId: string;
  let reviewId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const consultant = await prisma.user.create({
      data: { email: `${marker}-consultant@example.test`, role: 'CONSULTANT', status: 'ACTIVE' },
    });
    consultantId = consultant.id;
    const user = await prisma.user.create({
      data: {
        email: `${marker}-client@example.test`,
        role: 'CLIENT',
        status: 'ACTIVE',
        client: {
          create: {
            firstName: 'M3',
            lastName: 'Client',
            termsAcceptedAt: new Date(),
            assignedConsultantId: consultant.id,
          },
        },
      },
      include: { client: true },
    });
    userId = user.id;
    clientId = user.client!.id;
    const report = await prisma.creditReportDocument.create({
      data: {
        storageKey: `${marker}/report.pdf`,
        originalFileName: 'supported-report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        sha256: marker.padEnd(64, 'a').slice(0, 64),
        validationStatus: 'ACCEPTED',
        sourceEntered: 'Synthetic 3-Bureau fixture',
        reportDateEntered: new Date('2026-08-31'),
        uploadedByUserId: userId,
      },
    });
    const review = await prisma.creditReview.create({
      data: {
        clientId,
        consultantId,
        status: 'CONSULTANT_REVIEW',
        submittedAt: new Date(),
        intake: {
          create: {
            reportDocumentId: report.id,
            reportSource: 'Synthetic 3-Bureau fixture',
            reportDate: new Date('2026-08-31'),
            materialChanges: ['NO_CHANGES'],
            creditAccountsConfirmed: true,
            creditAccountReviews: [],
          },
        },
      },
    });
    reviewId = review.id;
    const runtime = new DurableAIRuntime(
      prisma,
      new RecordingAIQueue(),
      new Phase7DeterministicProvider(),
      phase7Validators,
    );
    await runDurablePhase7Pipeline({
      runtime,
      source: {
        reportDocumentId: report.id,
        clientId,
        sha256: report.sha256,
        acceptedReportDate: '2026-08-31',
        validationStatus: 'ACCEPTED',
      },
      report: supportedThreeBureauReport,
      cards: [],
      correlationId: marker,
    });
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: reviewId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.notification.deleteMany({ where: { clientId } });
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.publishedCreditReview.deleteMany({ where: { clientId } });
    await prisma.creditProfileState.deleteMany({ where: { clientId } });
    await prisma.creditReview.updateMany({ where: { clientId }, data: { snapshotId: null } });
    await prisma.creditSnapshot.deleteMany({ where: { clientId } });
    await prisma.reviewDraftOverride.deleteMany({ where: { reviewId } });
    await prisma.reviewDraftFinding.deleteMany({ where: { draft: { reviewId } } });
    await prisma.reviewDraft.deleteMany({ where: { reviewId } });
    await prisma.reviewVerificationException.deleteMany({ where: { reviewId } });
    await prisma.creditReportArtifact.deleteMany({ where: { aiJob: { clientId } } });
    await prisma.aIJobOutput.deleteMany({ where: { job: { clientId } } });
    await prisma.aIJob.deleteMany({ where: { clientId } });
    await prisma.creditReview.delete({ where: { id: reviewId } });
    await prisma.creditReportDocument.deleteMany({ where: { uploadedByUserId: userId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, consultantId] } } });
    await prisma.$disconnect();
  });

  test('persists source-derived profile, versioned overrides, finding decisions, approvals and canonical publication', async () => {
    let workspace = await getOrCreateReviewWorkspace(prisma, clientId, reviewId, consultantId);
    expect(workspace.draft?.version).toBe(1);
    expect(workspace.effectiveProfile?.experianScore).toBe(721);
    await saveReviewOverride(prisma, {
      clientId,
      reviewId,
      actorId: consultantId,
      expectedVersion: 1,
      fieldPath: 'aggregateUtilization',
      effectiveValue: 18,
      reason: 'Verified against accepted report page 4',
      sourceReference: { reportDocumentId: workspace.report.id, page: 4 },
    });
    await expect(
      saveReviewOverride(prisma, {
        clientId,
        reviewId,
        actorId: consultantId,
        expectedVersion: 1,
        fieldPath: 'aggregateUtilization',
        effectiveValue: 19,
        reason: 'stale',
        sourceReference: {},
      }),
    ).rejects.toMatchObject({ code: 'DRAFT_VERSION_CONFLICT' });
    workspace = await getOrCreateReviewWorkspace(prisma, clientId, reviewId, consultantId);
    expect(workspace.effectiveProfile?.aggregateUtilization).toBe(18);
    for (const finding of workspace.draft!.findings) {
      await decidePersistedFinding(prisma, {
        clientId,
        reviewId,
        actorId: consultantId,
        code: finding.code,
        action: 'APPROVE',
        expectedVersion: workspace.draft!.version,
      });
      workspace = await getOrCreateReviewWorkspace(prisma, clientId, reviewId, consultantId);
    }
    await saveReviewAnalysis(prisma, {
      clientId,
      reviewId,
      actorId: consultantId,
      expectedVersion: workspace.draft!.version,
      analysis: {
        clientSummary: 'Utilization is manageable; preserve payment history and apply selectively.',
      },
      recommendation: {
        outcome: 'PROCEED_SELECTIVELY',
        clientExplanation: 'Proceed selectively with consultant coordination.',
        reasons: ['Manage utilization'],
        approved: true,
      },
      approveAnalysis: true,
      approveRecommendation: true,
    });
    workspace = await getOrCreateReviewWorkspace(prisma, clientId, reviewId, consultantId);
    expect(await reviewWorkspaceReadiness(prisma, clientId, reviewId, 'CONSULTANT')).toMatchObject({
      ready: true,
      blockers: [],
    });
    const publication = await publishCreditReview(prisma, {
      clientId,
      reviewId,
      actorId: consultantId,
      actorRole: 'CONSULTANT',
      idempotencyKey: `${marker}:publish`,
      expectedDraftVersion: workspace.draft!.version,
    });
    const replay = await publishCreditReview(prisma, {
      clientId,
      reviewId,
      actorId: consultantId,
      actorRole: 'CONSULTANT',
      idempotencyKey: `${marker}:publish`,
      expectedDraftVersion: workspace.draft!.version,
    });
    expect(replay.id).toBe(publication.id);
    expect(await prisma.publishedCreditReview.count({ where: { reviewId } })).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { entityId: reviewId, action: 'CREDIT_REVIEW_PUBLISHED' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: reviewId, eventType: 'credit_review.published' },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { clientId, type: 'CREDIT_REVIEW_PUBLISHED' } }),
    ).toBe(1);
  });
});
