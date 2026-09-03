import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { roundAnalysisSource } from './analysis.js';

export function buildFinalizationBlockers(input: { sessionEnded: boolean; openApplication: boolean; requiredFollowUp: boolean; criticalAttention: boolean; finalAnalysis: boolean; analysisCurrent: boolean; journey: boolean }) {
  return [!input.sessionEnded && 'LIVE_SESSION_NOT_ENDED', input.openApplication && 'APPLICATION_UNRESOLVED', input.requiredFollowUp && 'REQUIRED_FOLLOW_UP_UNRESOLVED', input.criticalAttention && 'CRITICAL_ATTENTION_OPEN', !input.finalAnalysis && 'FINAL_ANALYSIS_REQUIRED', input.finalAnalysis && !input.analysisCurrent && 'FINAL_ANALYSIS_STALE', !input.journey && 'JOURNEY_REQUIRED'].filter(Boolean) as string[];
}

export async function finalizationReadiness(prisma: PrismaClient | Prisma.TransactionClient, roundId: string, clientId: string) {
  const round = await prisma.creditCardRound.findFirst({ where: { id: roundId, clientId } });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  const [session, openApplication, requiredFollowUp, criticalAttention, finalAnalysis, currentSource, journey] = await Promise.all([
    prisma.applicationSession.findFirst({ where: { roundId }, select: { endedAt: true } }),
    prisma.creditApplication.findFirst({ where: { roundId, status: { in: ['RELEASED','OPENED'] } }, select: { id: true } }),
    prisma.postRoundFollowUp.findFirst({ where: { roundId, required: true, status: { notIn: ['COMPLETE','WAIVED'] } }, select: { id: true, status: true } }),
    prisma.workItem.findFirst({ where: { clientId, sourceId: roundId, priority: 'URGENT', status: { in: ['OPEN','IN_PROGRESS','WAITING'] } }, select: { id: true } }),
    prisma.roundAnalysis.findFirst({ where: { roundId, kind: 'FINAL', status: 'APPROVED' }, orderBy: { version: 'desc' } }),
    roundAnalysisSource(prisma, roundId, clientId),
    prisma.creditJourney.findUnique({ where: { clientId } }),
  ]);
  const blockers = buildFinalizationBlockers({ sessionEnded: Boolean(session?.endedAt), openApplication: Boolean(openApplication), requiredFollowUp: Boolean(requiredFollowUp), criticalAttention: Boolean(criticalAttention), finalAnalysis: Boolean(finalAnalysis), analysisCurrent: finalAnalysis?.sourceFingerprint === currentSource.fingerprint, journey: Boolean(journey) });
  return { round, finalAnalysis, journey, blockers, ready: blockers.length === 0 };
}

export async function finalizeCreditCardRound(prisma: PrismaClient, input: { roundId: string; clientId: string; actorId: string; expectedVersion: number; confirmed: boolean; idempotencyKey: string }) {
  if (!input.confirmed) throw new AppError('FINALIZATION_CONFIRMATION_REQUIRED', 400, 'Explicitly confirm Round finalization');
  return executeConsequentialCommand(prisma, {
    idempotency: { scope: 'credit-card-round', subjectId: input.roundId, operation: 'finalize', key: input.idempotencyKey },
    audit: { action: 'CREDIT_CARD_ROUND_FINALIZED', entityType: 'CreditCardRound', entityId: input.roundId, clientId: input.clientId, actorId: input.actorId },
    outbox: { eventType: 'credit-card-round.finalized', eventKey: `round:${input.roundId}:finalized`, aggregateType: 'CreditCardRound', aggregateId: input.roundId, payload: { clientId: input.clientId, roundId: input.roundId, domains: ['round','journey','plan','notifications'] } },
    mutate: async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`round-finalize:${input.roundId}`}))`);
      const readiness = await finalizationReadiness(tx, input.roundId, input.clientId);
      if (!readiness.ready || !readiness.finalAnalysis || !readiness.journey) throw new AppError('ROUND_FINALIZATION_BLOCKED', 409, `Round is not ready: ${readiness.blockers.join(', ')}`);
      const claimed = await tx.creditCardRound.updateMany({ where: { id: input.roundId, clientId: input.clientId, status: { not: 'COMPLETE' }, finalizationVersion: input.expectedVersion }, data: { status: 'COMPLETE', completedAt: new Date(), finalAnalysisId: readiness.finalAnalysis.id, finalizedByUserId: input.actorId, finalizationVersion: { increment: 1 }, nextReviewAt: new Date(Date.now() + 90 * 86400000) } });
      if (claimed.count !== 1) throw new AppError('ROUND_FINALIZATION_CONFLICT', 409, 'Round changed or was already finalized');
      await tx.plan.updateMany({ where: { clientId: input.clientId, purpose: 'POST_ROUND', status: 'ACTIVE' }, data: { status: 'COMPLETED' } });
      await tx.planVersion.updateMany({ where: { plan: { clientId: input.clientId, purpose: 'POST_ROUND' }, status: 'ACTIVE' }, data: { status: 'COMPLETED' } });
      await tx.applicationCycle.update({ where: { id: readiness.round.cycleId }, data: { status: 'COMPLETE', currentStage: 'FINAL_RESULTS', finalResult: 'ROUND_FINALIZED', closedAt: new Date() } });
      await tx.nurturePeriod.updateMany({ where: { clientId: input.clientId, status: 'ACTIVE' }, data: { status: 'COMPLETE', endedAt: new Date() } });
      const nurture = await tx.nurturePeriod.create({ data: { clientId: input.clientId, journeyId: readiness.journey.id, reasonCode: 'POST_ROUND_MONITORING', expectedEnd: new Date(Date.now() + 90 * 86400000) } });
      let nurturePlan = await tx.plan.findFirst({ where: { clientId: input.clientId, purpose: 'NURTURE', status: 'ACTIVE' } });
      if (!nurturePlan) nurturePlan = await tx.plan.create({ data: { clientId: input.clientId, purpose: 'NURTURE', status: 'ACTIVE', title: 'Post-Round Nurture Plan', versions: { create: { version: 1, status: 'ACTIVE', sourceFingerprint: `round:${input.roundId}:final`, activatedAt: new Date(), items: { create: [{ stableKey: `round:${input.roundId}:next-review`, type: 'MILESTONE', completionMode: 'SYSTEM_VERIFY', status: 'AVAILABLE', owner: 'SYSTEM', clientTitle: 'Next Credit Profile Review', clientBody: 'We will recheck your current profile and eligibility before another Cycle.', required: true, targetAt: new Date(Date.now() + 90 * 86400000), deepLink: '/app/credit-center/review' }] } } } } });
      await tx.workItem.updateMany({ where: { clientId: input.clientId, sourceId: input.roundId, status: { in: ['OPEN','IN_PROGRESS','WAITING'] } }, data: { status: 'COMPLETED', completedAt: new Date(), resolvedAt: new Date() } });
      const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { userId: true } });
      if (client?.userId) await tx.notification.upsert({ where: { userId_semanticKey: { userId: client.userId, semanticKey: `round-finalized:${input.roundId}` } }, create: { userId: client.userId, clientId: input.clientId, semanticKey: `round-finalized:${input.roundId}`, type: 'ROUND_FINALIZED', title: 'Your card Round is complete', body: 'Your final analysis and next review plan are ready.', link: `/app/rounds/${input.roundId}/analysis`, safePayload: { roundId: input.roundId } }, update: {} });
      return { roundId: input.roundId, status: 'COMPLETE', finalAnalysisId: readiness.finalAnalysis.id, nurturePeriodId: nurture.id, nurturePlanId: nurturePlan.id, finalizationVersion: input.expectedVersion + 1 } as Prisma.InputJsonObject;
    },
  });
}
