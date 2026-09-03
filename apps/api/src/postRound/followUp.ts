import { createHash } from 'node:crypto';
import { Prisma, type CreditApplicationOutcome, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function initializePostRoundFollowUp(prisma: PrismaClient, input: { roundId: string; clientId: string; actorId: string; idempotencyKey: string }) {
  const round = await prisma.creditCardRound.findFirst({ where: { id: input.roundId, clientId: input.clientId } });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  if (!(await prisma.applicationSession.findFirst({ where: { roundId: round.id, endedAt: { not: null } } }))) throw new AppError('SESSION_NOT_ENDED', 409, 'End the live session before starting post-round follow-up');
  return executeConsequentialCommand(prisma, {
    idempotency: { scope: 'post-round', subjectId: round.id, operation: 'initialize', key: input.idempotencyKey },
    audit: { action: 'POST_ROUND_FOLLOW_UP_INITIALIZED', entityType: 'CreditCardRound', entityId: round.id, clientId: input.clientId, actorId: input.actorId },
    outbox: { eventType: 'plan.updated', eventKey: `post-round:${round.id}:initialized`, aggregateType: 'CreditCardRound', aggregateId: round.id, payload: { clientId: input.clientId, roundId: round.id, domains: ['plan', 'round'] } },
    mutate: async (tx) => {
      let plan = await tx.plan.findFirst({ where: { clientId: input.clientId, purpose: 'POST_ROUND', title: `Post-Round Follow-Up ${round.id}` }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
      if (!plan) plan = await tx.plan.create({ data: { clientId: input.clientId, purpose: 'POST_ROUND', status: 'ACTIVE', title: `Post-Round Follow-Up ${round.id}`, versions: { create: { version: 1, status: 'ACTIVE', sourceFingerprint: hash({ roundId: round.id, source: round.sourceFingerprint }), activatedAt: new Date() } } }, include: { versions: true } });
      const version = plan.versions[0]!;
      const applications = await tx.creditApplication.findMany({ where: { roundId: round.id, OR: [{ outcome: 'PENDING' }, { outcome: 'APPROVED', approvedLimitKnown: false }, { outcome: 'DECLINED' }] }, orderBy: [{ releasedAt: 'asc' }, { id: 'asc' }] });
      for (const application of applications) {
        const kind = application.outcome === 'DECLINED' ? 'RECONSIDERATION' : 'PENDING_APPLICATION';
        let followUp = await tx.postRoundFollowUp.findFirst({ where: { roundId: round.id, applicationId: application.id, kind } });
        if (!followUp) followUp = await tx.postRoundFollowUp.create({ data: { roundId: round.id, clientId: input.clientId, applicationId: application.id, kind, required: application.outcome !== 'DECLINED' } });
        const stableKey = `post-round:${followUp.id}`;
        const item = await tx.planItem.upsert({ where: { planVersionId_stableKey: { planVersionId: version.id, stableKey } }, create: { planVersionId: version.id, stableKey, type: 'ACTION', completionMode: 'STRUCTURED_OUTCOME', status: 'AVAILABLE', owner: 'CLIENT', clientTitle: kind === 'RECONSIDERATION' ? 'Record reconsideration result' : 'Confirm application result', clientBody: 'Update the factual result when it is known.', required: followUp.required, deepLink: `/app/rounds/${round.id}/follow-up`, outcomeSchema: { kind } }, update: {} });
        if (!followUp.planItemId) await tx.postRoundFollowUp.update({ where: { id: followUp.id }, data: { planItemId: item.id } });
      }
      return { planId: plan.id, created: applications.length } as Prisma.InputJsonObject;
    },
  });
}

export async function listPostRoundFollowUps(prisma: PrismaClient, roundId: string, clientId: string) {
  const round = await prisma.creditCardRound.findFirst({ where: { id: roundId, clientId } });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  return prisma.postRoundFollowUp.findMany({ where: { roundId, clientId }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] });
}

export async function completePostRoundFollowUp(prisma: PrismaClient, input: { followUpId: string; clientId: string; actorId: string; expectedVersion: number; outcome?: CreditApplicationOutcome; approvedLimitKnown?: boolean; approvedLimit?: number; issuerReason?: string; unable?: boolean; idempotencyKey: string }) {
  const followUp = await prisma.postRoundFollowUp.findFirst({ where: { id: input.followUpId, clientId: input.clientId } });
  if (!followUp) throw new AppError('FOLLOW_UP_NOT_FOUND', 404, 'Follow-up action was not found');
  const requestHash = hash(input);
  return executeConsequentialCommand(prisma, {
    idempotency: { scope: 'post-round-follow-up', subjectId: followUp.id, operation: 'complete', key: input.idempotencyKey, requestHash },
    audit: (result) => ({ action: input.unable ? 'POST_ROUND_FOLLOW_UP_UNABLE' : 'POST_ROUND_FOLLOW_UP_COMPLETED', entityType: 'PostRoundFollowUp', entityId: followUp.id, clientId: input.clientId, actorId: input.actorId, metadata: result }),
    outbox: { eventType: 'application.updated', eventKey: `post-round-follow-up:${followUp.id}:${input.idempotencyKey}`, aggregateType: 'PostRoundFollowUp', aggregateId: followUp.id, payload: { clientId: input.clientId, roundId: followUp.roundId, applicationId: followUp.applicationId, domains: ['application', 'round', 'plan'] } },
    mutate: async (tx) => {
      const claimed = await tx.postRoundFollowUp.updateMany({ where: { id: followUp.id, version: input.expectedVersion, status: 'OPEN' }, data: { status: input.unable ? 'UNABLE_TO_COMPLETE' : 'COMPLETE', currentResult: input as unknown as Prisma.InputJsonObject, completedAt: input.unable ? null : new Date(), version: { increment: 1 } } });
      if (claimed.count !== 1) throw new AppError('FOLLOW_UP_VERSION_CONFLICT', 409, 'Follow-up changed; reload before retrying');
      if (!input.unable && followUp.applicationId) {
        if (!input.outcome) throw new AppError('FOLLOW_UP_OUTCOME_REQUIRED', 400, 'Choose the current application result');
        if (input.outcome === 'APPROVED' && input.approvedLimitKnown && !(input.approvedLimit && input.approvedLimit > 0)) throw new AppError('APPROVED_LIMIT_REQUIRED', 400, 'Enter the known approved limit');
        const application = await tx.creditApplication.update({ where: { id: followUp.applicationId }, data: { status: 'RESULT_RECORDED', outcome: input.outcome, approvedLimitKnown: input.outcome === 'APPROVED' ? Boolean(input.approvedLimitKnown) : null, approvedLimit: input.outcome === 'APPROVED' && input.approvedLimitKnown ? (input.approvedLimit ?? null) : null, issuerReason: input.issuerReason ?? null, resultRecordedAt: new Date(), version: { increment: 1 } } });
        await tx.creditApplicationEvent.create({ data: { applicationId: application.id, sessionId: application.sessionId, actorUserId: input.actorId, eventType: followUp.kind === 'RECONSIDERATION' ? 'RECONSIDERATION_RESULT_RECORDED' : 'FOLLOW_UP_RESULT_RECORDED', outcome: input.outcome, payload: { approvedLimitKnown: input.approvedLimitKnown ?? null, approvedLimit: input.approvedLimit ?? null } } });
      }
      if (followUp.planItemId) await tx.planItem.update({ where: { id: followUp.planItemId }, data: { status: input.unable ? 'UNABLE' : 'COMPLETED', completedAt: input.unable ? null : new Date() } });
      return { id: followUp.id, status: input.unable ? 'UNABLE_TO_COMPLETE' : 'COMPLETE', version: input.expectedVersion + 1 } as Prisma.InputJsonObject;
    },
  });
}
