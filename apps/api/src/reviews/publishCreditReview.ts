import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  clientSafeReviewProjection,
  reviewReadiness,
  type DraftFinding,
  type RecommendationDraft,
} from './reviewAnalysis.js';

export async function publishCreditReview(
  prisma: PrismaClient,
  input: {
    reviewId: string;
    clientId: string;
    actorId: string;
    actorRole: string;
    idempotencyKey: string;
    expectedDraftVersion: number;
    failAfterSnapshot?: boolean;
  },
) {
  const replay = await prisma.publishedCreditReview.findUnique({
    where: { reviewId: input.reviewId },
  });
  if (replay) return replay;
  try {
    return await prisma.$transaction(
      async (tx) => {
        const review = await tx.creditReview.findFirst({
          where: { id: input.reviewId, clientId: input.clientId },
          include: {
            intake: { include: { reportDocument: true } },
            drafts: { orderBy: { version: 'desc' }, take: 1, include: { findings: true } },
            verificationExceptions: true,
            client: { select: { userId: true } },
          },
        });
        if (!review || !review.intake?.reportDocument || !review.client.userId)
          throw new Error('REVIEW_NOT_PUBLISHABLE');
        const draft = review.drafts[0];
        if (!draft || draft.version !== input.expectedDraftVersion)
          throw new Error('DRAFT_VERSION_CONFLICT');
        const report = review.intake.reportDocument;
        const recommendation = draft.recommendation as RecommendationDraft | null;
        const findings = draft.findings.map((x) => ({
          code: x.code,
          title: x.title,
          ...(x.clientSummary ? { clientSummary: x.clientSummary } : {}),
          ...(x.internalDetail ? { internalDetail: x.internalDetail } : {}),
          severity: x.severity,
          status: x.status,
          origin: x.origin as DraftFinding['origin'],
          evidence: x.evidence as unknown[],
          ...(x.aiProvenance ? { aiProvenance: x.aiProvenance } : {}),
          ...(x.actorId ? { actorId: x.actorId } : {}),
          version: x.version,
        }));
        const sourceVersions = draft.sourceVersions as Record<string, unknown>;
        const readiness = reviewReadiness({
          sourceAccepted: report.validationStatus === 'ACCEPTED',
          sourceCurrent: sourceVersions.report === report.sha256,
          profileValid: typeof draft.profile === 'object' && draft.profile !== null,
          exceptions: review.verificationExceptions
            .filter((x) => x.blocking && x.status === 'OPEN')
            .map((x) => `EXCEPTION:${x.exceptionKey}`),
          findings,
          recommendation: recommendation ?? {
            outcome: 'WAIT_NURTURE',
            clientExplanation: '',
            reasons: [],
            approved: false,
          },
          actorRole: input.actorRole,
        });
        if (!readiness.ready || !recommendation)
          throw new Error(`PUBLICATION_BLOCKED:${readiness.blockers.join(',')}`);
        const profile = draft.profile as Record<string, unknown>;
        const number = (key: string) =>
          typeof profile[key] === 'number' ? (profile[key] as number) : null;
        const snapshot = await tx.creditSnapshot.create({
          data: {
            clientId: input.clientId,
            capturedAt: new Date(),
            expiresAt: new Date(Date.now() + 180 * 86400000),
            source: 'PUBLISHED_CREDIT_REVIEW',
            experianScore: number('experianScore'),
            equifaxScore: number('equifaxScore'),
            transunionScore: number('transunionScore'),
            aggregateUtilization: number('aggregateUtilization'),
            revolvingBalance: number('revolvingBalance'),
            revolvingLimit: number('revolvingLimit'),
            openAccounts: number('openAccounts'),
            recentInquiries: number('recentInquiries'),
            derogatoryItems: number('derogatoryItems'),
          },
        });
        if (input.failAfterSnapshot) throw new Error('SIMULATED_PUBLICATION_FAILURE');
        const safe = clientSafeReviewProjection({
          profile,
          findings,
          recommendation,
          analysisSummary:
            (draft.analysis as { clientSummary?: string } | null)?.clientSummary ?? '',
        });
        const publication = await tx.publishedCreditReview.create({
          data: {
            reviewId: review.id,
            clientId: input.clientId,
            snapshotId: snapshot.id,
            idempotencyKey: input.idempotencyKey,
            sourceVersions: sourceVersions as Prisma.InputJsonValue,
            clientSafeProjection: safe as Prisma.InputJsonValue,
            recommendation: recommendation.outcome,
            publishedByUserId: input.actorId,
          },
        });
        await tx.creditReview.update({
          where: { id: review.id },
          data: {
            status: 'COMPLETE',
            snapshotId: snapshot.id,
            consultantId: input.actorId,
            recommendation: recommendation.outcome,
            clientSummary: safe.analysisSummary,
            completedAt: publication.publishedAt,
          },
        });
        await tx.creditProfileState.upsert({
          where: { clientId: input.clientId },
          create: {
            clientId: input.clientId,
            status: 'CURRENT',
            sourceReviewId: review.id,
            effectiveAt: publication.publishedAt,
          },
          update: {
            status: 'CURRENT',
            sourceReviewId: review.id,
            effectiveAt: publication.publishedAt,
            staleAt: null,
          },
        });
        await tx.workItem.updateMany({
          where: {
            clientId: input.clientId,
            sourceType: 'CreditReview',
            sourceId: review.id,
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
          },
          data: {
            status: 'COMPLETED',
            completedAt: publication.publishedAt,
            resolvedAt: publication.publishedAt,
          },
        });
        await tx.notification.upsert({
          where: {
            userId_semanticKey: {
              userId: review.client.userId,
              semanticKey: `credit-review-published:${review.id}`,
            },
          },
          create: {
            userId: review.client.userId,
            clientId: input.clientId,
            semanticKey: `credit-review-published:${review.id}`,
            type: 'CREDIT_REVIEW_PUBLISHED',
            title: 'Your Credit Review is ready',
            body: 'Your consultant published your Credit Review.',
            safePayload: { reviewId: review.id },
            link: '/app/credit-center',
          },
          update: {},
        });
        await tx.auditEvent.create({
          data: {
            clientId: input.clientId,
            actorId: input.actorId,
            action: 'CREDIT_REVIEW_PUBLISHED',
            entityType: 'CreditReview',
            entityId: review.id,
            correlationId: input.idempotencyKey,
            metadata: { snapshotId: snapshot.id, draftVersion: draft.version },
          },
        });
        await tx.outboxEvent.upsert({
          where: { eventKey: `credit-review-published:${review.id}` },
          create: {
            eventType: 'credit_review.published',
            eventKey: `credit-review-published:${review.id}`,
            aggregateType: 'CreditReview',
            aggregateId: review.id,
            payload: {
              clientId: input.clientId,
              domains: ['review', 'credit-profile', 'notifications'],
            },
          },
          update: {},
        });
        return publication;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      const winner = await prisma.publishedCreditReview.findUnique({
        where: { reviewId: input.reviewId },
      });
      if (winner) return winner;
    }
    throw error;
  }
}
