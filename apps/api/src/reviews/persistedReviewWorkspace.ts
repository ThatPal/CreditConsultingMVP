import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { reviewReadiness, type DraftFinding, type RecommendationDraft } from './reviewAnalysis.js';
import { materializeProfile, reviewContextVersion } from './reviewWorkspace.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;

async function loadContext(prisma: PrismaClient, clientId: string, reviewId: string) {
  const review = await prisma.creditReview.findFirst({
    where: { id: reviewId, clientId },
    include: {
      intake: {
        include: {
          reportDocument: {
            include: {
              aiArtifacts: {
                where: { current: true, staleAt: null },
                orderBy: [{ artifactType: 'asc' }, { artifactVersion: 'desc' }],
              },
            },
          },
        },
      },
      client: {
        include: {
          goals: { orderBy: { updatedAt: 'desc' }, take: 1 },
          cards: { orderBy: { id: 'asc' } },
          creditSnapshots: { orderBy: { capturedAt: 'desc' }, take: 1 },
        },
      },
      clientUpdates: { where: { supersededAt: null }, orderBy: { id: 'asc' } },
      verificationExceptions: { orderBy: [{ blocking: 'desc' }, { exceptionKey: 'asc' }] },
      drafts: {
        orderBy: { version: 'desc' },
        take: 1,
        include: {
          overrides: { orderBy: { fieldPath: 'asc' } },
          findings: { orderBy: { code: 'asc' } },
        },
      },
    },
  });
  if (!review?.intake?.reportDocument)
    throw new AppError('NOT_FOUND', 404, 'Credit Review workspace was not found');
  const report = review.intake.reportDocument;
  const artifacts = report.aiArtifacts;
  const contextVersions = {
    report: report.sha256,
    artifacts: artifacts.map((a) => `${a.artifactType}:${a.artifactVersion}:${a.sourceVersion}`),
    goal: review.client.goals[0]?.updatedAt.toISOString() ?? 'none',
    cards: review.client.cards.map((c) => `${c.id}:${c.updatedAt.toISOString()}`).join('|'),
    updates: review.clientUpdates
      .map((u) => `${u.id}:${u.createdAt.toISOString()}:${JSON.stringify(u.provenance)}`)
      .join('|'),
  };
  return {
    review,
    report,
    artifacts,
    contextVersions,
    contextVersion: reviewContextVersion(contextVersions),
  };
}

function sourceProfile(artifacts: Array<{ artifactType: string; payload: unknown }>) {
  const extraction = artifacts.find((a) => a.artifactType === 'credit_report.extract')?.payload as
    | {
        facts?: {
          scores?: Array<{ bureau: string; score: number }>;
          tradelines?: Array<{
            accountType?: string;
            balance?: number;
            limit?: number;
            status?: string;
          }>;
          inquiries?: unknown[];
          negativeItems?: unknown[];
        };
      }
    | undefined;
  const facts = extraction?.facts;
  const scores = facts?.scores ?? [];
  const score = (bureau: string) => scores.find((s) => s.bureau === bureau)?.score;
  const revolving = (facts?.tradelines ?? []).filter((x) =>
    /revolv|credit card/i.test(x.accountType ?? ''),
  );
  const sum = (key: 'balance' | 'limit') =>
    revolving.reduce((total, x) => total + (typeof x[key] === 'number' ? x[key]! : 0), 0);
  const revolvingBalance = sum('balance');
  const revolvingLimit = sum('limit');
  return {
    experianScore: score('EXPERIAN'),
    equifaxScore: score('EQUIFAX'),
    transunionScore: score('TRANSUNION'),
    revolvingBalance,
    revolvingLimit,
    aggregateUtilization:
      revolvingLimit > 0 ? Number(((revolvingBalance / revolvingLimit) * 100).toFixed(2)) : null,
    openAccounts: (facts?.tradelines ?? []).filter((x) => !/closed/i.test(x.status ?? '')).length,
    recentInquiries: facts?.inquiries?.length ?? 0,
    derogatoryItems: facts?.negativeItems?.length ?? 0,
  };
}

export async function getOrCreateReviewWorkspace(
  prisma: PrismaClient,
  clientId: string,
  reviewId: string,
  actorId: string,
) {
  let context = await loadContext(prisma, clientId, reviewId);
  let draft = context.review.drafts[0];
  if (!draft && context.artifacts.some((a) => a.artifactType === 'credit_report.extract')) {
    await prisma.$transaction(async (tx) => {
      const profile = sourceProfile(context.artifacts);
      await tx.reviewDraft.create({
        data: {
          reviewId,
          version: 1,
          sourceVersions: json(context.contextVersions),
          profile: json(profile),
          contextVersion: context.contextVersion,
          createdByUserId: actorId,
          findings: {
            create: [
              {
                code: 'UTILIZATION',
                title: 'Revolving utilization',
                clientSummary: `Reported revolving utilization is ${profile.aggregateUtilization ?? 'not available'}%.`,
                severity:
                  typeof profile.aggregateUtilization === 'number' &&
                  profile.aggregateUtilization > 30
                    ? 'CAUTION'
                    : 'INFORMATIONAL',
                origin: 'DETERMINISTIC',
                evidence: json([{ source: 'credit_report.extract', field: 'tradelines' }]),
              },
              {
                code: 'RECENT_INQUIRIES',
                title: 'Recent inquiries',
                clientSummary: `${profile.recentInquiries} recent inquiries were represented in the accepted report.`,
                severity: profile.recentInquiries > 2 ? 'CAUTION' : 'INFORMATIONAL',
                origin: 'DETERMINISTIC',
                evidence: json([{ source: 'credit_report.extract', field: 'inquiries' }]),
              },
            ],
          },
        },
      });
      for (const artifact of context.artifacts) {
        const output = await tx.aIJobOutput.findUnique({
          where: { id: artifact.aiJobOutputId },
          select: { exceptions: true, provenance: true },
        });
        const exceptions = Array.isArray(output?.exceptions) ? output.exceptions : [];
        for (const candidate of exceptions) {
          const item = candidate as Record<string, unknown>;
          const key = String(
            item.key ?? `${artifact.artifactType}:${exceptions.indexOf(candidate)}`,
          );
          await tx.reviewVerificationException.upsert({
            where: { reviewId_exceptionKey: { reviewId, exceptionKey: key } },
            create: {
              reviewId,
              exceptionKey: key,
              category: String(item.category ?? 'AI_REVIEW'),
              summary: String(item.summary ?? 'Review source exception'),
              materiality: String(item.materiality ?? 'material'),
              blocking: item.blockingBehavior === 'publication',
              evidence: json(item.evidence ?? []),
            },
            update: {},
          });
        }
      }
    });
    context = await loadContext(prisma, clientId, reviewId);
    draft = context.review.drafts[0];
  }
  const jobs = await prisma.aIJob.findMany({
    where: {
      clientId,
      relatedEntityType: 'CreditReportDocument',
      relatedEntityId: context.report.id,
    },
    select: {
      id: true,
      status: true,
      failureCode: true,
      processDefinition: { select: { processKey: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const effectiveProfile = draft
    ? materializeProfile(
        draft.profile as Record<string, unknown>,
        draft.overrides.map((o) => ({
          fieldPath: o.fieldPath,
          originalValue: o.originalValue,
          effectiveValue: o.effectiveValue,
          reason: o.reason,
          actorId: o.actorId,
          sourceReference: o.sourceReference,
          createdAt: o.createdAt.toISOString(),
        })),
      )
    : null;
  return {
    review: context.review,
    report: context.report,
    artifacts: context.artifacts,
    jobs,
    draft,
    effectiveProfile,
    currentContextVersion: context.contextVersion,
    stale: Boolean(draft && draft.contextVersion !== context.contextVersion),
  };
}

export async function saveReviewOverride(
  prisma: PrismaClient,
  input: {
    clientId: string;
    reviewId: string;
    actorId: string;
    expectedVersion: number;
    fieldPath: string;
    effectiveValue: unknown;
    reason: string;
    sourceReference: unknown;
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const draft = await tx.reviewDraft.findFirst({
        where: {
          reviewId: input.reviewId,
          review: { clientId: input.clientId },
          version: input.expectedVersion,
        },
        orderBy: { version: 'desc' },
      });
      if (!draft)
        throw new AppError(
          'DRAFT_VERSION_CONFLICT',
          409,
          'Review draft changed; refresh before saving',
        );
      const profile = draft.profile as Record<string, unknown>;
      await tx.reviewDraftOverride.upsert({
        where: { draftId_fieldPath: { draftId: draft.id, fieldPath: input.fieldPath } },
        create: {
          reviewId: input.reviewId,
          draftId: draft.id,
          fieldPath: input.fieldPath,
          originalValue: json(profile[input.fieldPath] ?? null),
          effectiveValue: json(input.effectiveValue),
          reason: input.reason,
          sourceReference: json(input.sourceReference),
          actorId: input.actorId,
        },
        update: {
          effectiveValue: json(input.effectiveValue),
          reason: input.reason,
          sourceReference: json(input.sourceReference),
          actorId: input.actorId,
        },
      });
      return tx.reviewDraft.update({
        where: { id: draft.id },
        data: { version: { increment: 1 } },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function resolveReviewException(
  prisma: PrismaClient,
  input: {
    clientId: string;
    reviewId: string;
    actorId: string;
    exceptionKey: string;
    reason: string;
  },
) {
  const result = await prisma.reviewVerificationException.updateMany({
    where: {
      reviewId: input.reviewId,
      exceptionKey: input.exceptionKey,
      review: { clientId: input.clientId },
      status: 'OPEN',
    },
    data: {
      status: 'RESOLVED',
      resolutionReason: input.reason,
      resolvedByUserId: input.actorId,
      resolvedAt: new Date(),
    },
  });
  if (result.count !== 1)
    throw new AppError('EXCEPTION_NOT_FOUND', 404, 'Open exception was not found');
}

export async function saveReviewAnalysis(
  prisma: PrismaClient,
  input: {
    clientId: string;
    reviewId: string;
    actorId: string;
    expectedVersion: number;
    analysis: unknown;
    recommendation?: RecommendationDraft | undefined;
    approveAnalysis?: boolean | undefined;
    approveRecommendation?: boolean | undefined;
  },
) {
  return prisma.$transaction(
    async (tx) => {
      const draft = await tx.reviewDraft.findFirst({
        where: {
          reviewId: input.reviewId,
          review: { clientId: input.clientId },
          version: input.expectedVersion,
        },
        orderBy: { version: 'desc' },
      });
      if (!draft)
        throw new AppError(
          'DRAFT_VERSION_CONFLICT',
          409,
          'Review draft changed; refresh before saving',
        );
      return tx.reviewDraft.update({
        where: { id: draft.id },
        data: {
          version: { increment: 1 },
          analysis: json(input.analysis),
          ...(input.recommendation
            ? {
                recommendation: json({
                  ...input.recommendation,
                  approved: Boolean(input.approveRecommendation),
                  ...(input.approveRecommendation ? { approvedBy: input.actorId } : {}),
                }),
              }
            : {}),
          ...(input.approveAnalysis
            ? { analysisApprovedAt: new Date(), approvedByUserId: input.actorId }
            : {}),
          ...(input.approveRecommendation
            ? { recommendationApprovedAt: new Date(), approvedByUserId: input.actorId }
            : {}),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function decidePersistedFinding(
  prisma: PrismaClient,
  input: {
    clientId: string;
    reviewId: string;
    actorId: string;
    code: string;
    action: 'APPROVE' | 'EDIT' | 'DISMISS';
    clientSummary?: string | undefined;
    reason?: string | undefined;
    expectedVersion: number;
  },
) {
  const draft = await prisma.reviewDraft.findFirst({
    where: { reviewId: input.reviewId, review: { clientId: input.clientId } },
    orderBy: { version: 'desc' },
    include: { findings: true },
  });
  if (!draft || draft.version !== input.expectedVersion)
    throw new AppError(
      'DRAFT_VERSION_CONFLICT',
      409,
      'Review draft changed; refresh before saving',
    );
  const finding = draft.findings.find((x) => x.code === input.code);
  if (!finding) throw new AppError('FINDING_NOT_FOUND', 404, 'Finding was not found');
  if (input.action === 'DISMISS' && !input.reason?.trim())
    throw new AppError('DECISION_REASON_REQUIRED', 400, 'A dismissal reason is required');
  await prisma.$transaction([
    prisma.reviewDraftFinding.update({
      where: { id: finding.id },
      data: {
        status: input.action === 'DISMISS' ? 'DISMISSED' : 'APPROVED',
        ...(input.clientSummary ? { clientSummary: input.clientSummary } : {}),
        ...(input.reason ? { decisionReason: input.reason } : {}),
        actorId: input.actorId,
        version: { increment: 1 },
      },
    }),
    prisma.reviewDraft.update({ where: { id: draft.id }, data: { version: { increment: 1 } } }),
  ]);
}

export async function reviewWorkspaceReadiness(
  prisma: PrismaClient,
  clientId: string,
  reviewId: string,
  actorRole: string,
) {
  const workspace = await getOrCreateReviewWorkspace(
    prisma,
    clientId,
    reviewId,
    '00000000-0000-0000-0000-000000000000',
  );
  const draft = workspace.draft;
  if (!draft)
    return {
      ready: false,
      blockers: ['AI_PROCESSING_INCOMPLETE'],
      planState: 'STAGED_FOR_PHASE_9' as const,
    };
  const recommendation = draft.recommendation as RecommendationDraft | null;
  const findings: DraftFinding[] = draft.findings.map((x) => ({
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
  return reviewReadiness({
    sourceAccepted: workspace.report.validationStatus === 'ACCEPTED',
    sourceCurrent: !workspace.stale,
    profileValid: Boolean(workspace.effectiveProfile),
    exceptions: workspace.review.verificationExceptions
      .filter((x) => x.blocking && x.status === 'OPEN')
      .map((x) => `EXCEPTION:${x.exceptionKey}`),
    findings,
    recommendation: recommendation ?? {
      outcome: 'WAIT_NURTURE',
      clientExplanation: '',
      reasons: [],
      approved: false,
    },
    actorRole,
  });
}
