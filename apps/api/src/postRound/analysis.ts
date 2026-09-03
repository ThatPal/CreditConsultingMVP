import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient, type RoundAnalysisKind } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { getPostRoundSummary } from './summary.js';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function roundAnalysisSource(prisma: PrismaClient | Prisma.TransactionClient, roundId: string, clientId: string) {
  const applications = await prisma.creditApplication.findMany({ where: { roundId, clientId }, select: { id: true, version: true, status: true, outcome: true, approvedLimitKnown: true, approvedLimit: true, updatedAt: true }, orderBy: { id: 'asc' } });
  const followUps = await prisma.postRoundFollowUp.findMany({ where: { roundId, clientId }, select: { id: true, version: true, status: true, updatedAt: true }, orderBy: { id: 'asc' } });
  const snapshot = { applications: applications.map((x) => ({ ...x, approvedLimit: x.approvedLimit?.toString() ?? null })), followUps };
  return { snapshot, fingerprint: hash(snapshot) };
}

export async function prepareRoundAnalysis(prisma: PrismaClient, input: { roundId: string; clientId: string; actorId: string; kind: RoundAnalysisKind; clientSafeContent?: Prisma.InputJsonObject; idempotencyKey: string }) {
  const summary = await getPostRoundSummary(prisma, input.roundId, input.clientId, true);
  const currentSource = await roundAnalysisSource(prisma, input.roundId, input.clientId);
  return executeConsequentialCommand(prisma, {
    idempotency: { scope: 'round-analysis', subjectId: input.roundId, operation: `prepare:${input.kind}`, key: input.idempotencyKey, requestHash: hash({ kind: input.kind, source: currentSource.fingerprint }) },
    audit: (result) => ({ action: 'ROUND_ANALYSIS_PREPARED', entityType: 'RoundAnalysis', entityId: String((result as { id: string }).id), clientId: input.clientId, actorId: input.actorId }),
    outbox: { eventType: 'round.analysis-updated', eventKey: `round:${input.roundId}:analysis:${input.idempotencyKey}`, aggregateType: 'CreditCardRound', aggregateId: input.roundId, payload: { clientId: input.clientId, roundId: input.roundId, domains: ['round', 'analysis'] } },
    mutate: async (tx) => {
      const latest = await tx.roundAnalysis.findFirst({ where: { roundId: input.roundId }, orderBy: { version: 'desc' } });
      const defaultContent = { headline: `${summary.counts.approved} approved, ${summary.counts.pending} pending`, summary: `Known approved credit is $${summary.knownApprovedAmount.toLocaleString()}.`, nextActions: summary.unresolvedFollowUpCount ? ['Complete unresolved factual follow-up'] : ['Continue with the approved next-step plan'] };
      const analysis = await tx.roundAnalysis.create({ data: { roundId: input.roundId, clientId: input.clientId, version: (latest?.version ?? 0) + 1, kind: input.kind, sourceFingerprint: currentSource.fingerprint, sourceSnapshot: currentSource.snapshot as unknown as Prisma.InputJsonObject, deterministicFacts: { counts: summary.counts, knownApprovedAmount: summary.knownApprovedAmount, goal: summary.goal } as Prisma.InputJsonObject, clientSafeContent: input.clientSafeContent ?? defaultContent, preparedBy: 'DETERMINISTIC_MANUAL_FALLBACK' } });
      return { id: analysis.id, version: analysis.version, kind: analysis.kind } as Prisma.InputJsonObject;
    },
  });
}

export async function approveRoundAnalysis(prisma: PrismaClient, input: { analysisId: string; clientId: string; actorId: string; idempotencyKey: string }) {
  const analysis = await prisma.roundAnalysis.findFirst({ where: { id: input.analysisId, clientId: input.clientId } });
  if (!analysis) throw new AppError('ANALYSIS_NOT_FOUND', 404, 'Round analysis was not found');
  const currentSource = await roundAnalysisSource(prisma, analysis.roundId, input.clientId);
  if (currentSource.fingerprint !== analysis.sourceFingerprint) throw new AppError('ANALYSIS_SOURCE_STALE', 409, 'Application results changed; prepare an updated analysis');
  return executeConsequentialCommand(prisma, {
    idempotency: { scope: 'round-analysis', subjectId: analysis.id, operation: 'approve', key: input.idempotencyKey },
    audit: { action: 'ROUND_ANALYSIS_APPROVED', entityType: 'RoundAnalysis', entityId: analysis.id, clientId: input.clientId, actorId: input.actorId },
    outbox: { eventType: 'round.analysis-published', eventKey: `round-analysis:${analysis.id}:approved`, aggregateType: 'CreditCardRound', aggregateId: analysis.roundId, payload: { clientId: input.clientId, roundId: analysis.roundId, analysisId: analysis.id, domains: ['round', 'analysis'] } },
    mutate: async (tx) => {
      await tx.roundAnalysis.updateMany({ where: { roundId: analysis.roundId, status: 'APPROVED', id: { not: analysis.id } }, data: { status: 'SUPERSEDED', supersededAt: new Date() } });
      const claimed = await tx.roundAnalysis.updateMany({ where: { id: analysis.id, status: 'DRAFT', sourceFingerprint: currentSource.fingerprint }, data: { status: 'APPROVED', approvedByUserId: input.actorId, approvedAt: new Date() } });
      if (claimed.count !== 1) throw new AppError('ANALYSIS_APPROVAL_CONFLICT', 409, 'Analysis was already changed');
      return { id: analysis.id, version: analysis.version, status: 'APPROVED' } as Prisma.InputJsonObject;
    },
  });
}

export async function getRoundAnalysis(prisma: PrismaClient, roundId: string, clientId: string, consultant = false) {
  const currentSource = await roundAnalysisSource(prisma, roundId, clientId);
  const analyses = await prisma.roundAnalysis.findMany({ where: { roundId, clientId, ...(consultant ? {} : { status: 'APPROVED' }) }, orderBy: { version: 'desc' } });
  return { current: analyses[0] ? { ...analyses[0], stale: analyses[0].sourceFingerprint !== currentSource.fingerprint, ...(consultant ? {} : { internalContent: undefined, sourceSnapshot: undefined }) } : null, history: analyses.map((x) => ({ id: x.id, version: x.version, kind: x.kind, status: x.status, approvedAt: x.approvedAt })), sourceFingerprint: consultant ? currentSource.fingerprint : undefined };
}
