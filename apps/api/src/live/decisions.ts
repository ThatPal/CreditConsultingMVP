import { createHash } from 'node:crypto';
import {
  Prisma,
  type CreditApplicationOutcome,
  type LiveExecutionDecisionType,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { assertCurrentPreLiveConfirmation } from './confirmations.js';
import { assertSupervised } from './applications.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Trigger = CreditApplicationOutcome | 'SKIPPED';

export function evaluateFrozenRule(
  rule: unknown,
  trigger: Trigger,
  hasNext: boolean,
): { decisionType: LiveExecutionDecisionType; reasonCode: string } {
  const key =
    trigger === 'APPROVED'
      ? 'onApproved'
      : trigger === 'DECLINED'
        ? 'onDeclined'
        : trigger === 'PENDING'
          ? 'onPending'
          : trigger === 'SKIPPED'
            ? 'onSkipped'
            : trigger === 'APPLICATION_NOT_COMPLETED' || trigger === 'TECHNICAL_ISSUE'
              ? 'onNotCompleted'
              : 'onUnexpected';
  const value =
    rule && typeof rule === 'object' ? (rule as Record<string, unknown>)[key] : undefined;
  if (trigger === 'PENDING')
    return { decisionType: 'WAIT_FOR_CLIENT_RESULT', reasonCode: 'OUTCOME_PENDING' };
  if (value === 'stop')
    return {
      decisionType: 'STOP_APPLICATION_SEQUENCE',
      reasonCode: `POLICY_${key.toUpperCase()}_STOP`,
    };
  if (value === 'review' || value === 'pause')
    return {
      decisionType: 'INTERVENTION_REQUIRED',
      reasonCode: `POLICY_${key.toUpperCase()}_REVIEW`,
    };
  if (value === 'continue' || value === 'next')
    return hasNext
      ? {
          decisionType: 'READY_TO_RELEASE_ALLOWED_CARD',
          reasonCode: `POLICY_${key.toUpperCase()}_NEXT`,
        }
      : { decisionType: 'END_SESSION_READY', reasonCode: 'STRATEGY_SEQUENCE_COMPLETE' };
  return { decisionType: 'INTERVENTION_REQUIRED', reasonCode: 'AMBIGUOUS_OR_MISSING_FROZEN_RULE' };
}

export async function evaluateLatestResult(
  prisma: PrismaClient,
  input: { sessionId: string; consultantId: string; idempotencyKey: string },
) {
  const session = await prisma.applicationSession.findFirst({
    where: { id: input.sessionId, consultantId: input.consultantId },
  });
  if (!session) throw new AppError('FORBIDDEN', 403, 'Session supervision is not permitted');
  const event = await prisma.creditApplicationEvent.findFirst({
    where: { sessionId: session.id, eventType: { in: ['RESULT_RECORDED', 'SKIPPED'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  if (!event)
    throw new AppError(
      'EXECUTION_TRIGGER_REQUIRED',
      409,
      'No application result or Skip is ready for evaluation',
    );
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: event.applicationId },
  });
  const occurrence = await prisma.strategyApplication.findUniqueOrThrow({
    where: { id: application.strategyApplicationId },
  });
  const next = await prisma.strategyApplication.findFirst({
    where: {
      strategyVersionId: session.strategyVersionId,
      role: 'PLANNED',
      sequence: { gt: occurrence.sequence },
    },
    orderBy: [{ sequence: 'asc' }, { id: 'asc' }],
  });
  const trigger: Trigger = event.eventType === 'SKIPPED' ? 'SKIPPED' : (event.outcome ?? 'OTHER');
  // A frozen stop rule is authoritative when both snapshots define the same trigger.
  const rule = {
    ...(occurrence.reconsiderationRule as object),
    ...(occurrence.stopRule as object),
  };
  const evaluation = evaluateFrozenRule(rule, trigger, Boolean(next));
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'session',
      subjectId: session.id,
      operation: 'execution.evaluate',
      key: input.idempotencyKey,
      requestHash: hash({ eventId: event.id }),
    },
    audit: (result) => ({
      action: 'LIVE_EXECUTION_DECIDED',
      entityType: 'LiveExecutionDecision',
      entityId: String((result as { id: string }).id),
      clientId: session.clientId,
      actorId: input.consultantId,
    }),
    outbox: {
      eventType: 'session.execution-decided',
      eventKey: `session:${session.id}:decision:${event.id}`,
      aggregateType: 'ApplicationSession',
      aggregateId: session.id,
      payload: (result) => ({
        clientId: session.clientId,
        domains: ['live-session', 'attention'],
        sessionId: session.id,
        decisionId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      await tx.liveExecutionDecision.updateMany({
        where: { sessionId: session.id, current: true },
        data: { current: false, supersededAt: new Date() },
      });
      const decision = await tx.liveExecutionDecision.create({
        data: {
          sessionId: session.id,
          sourceApplicationId: application.id,
          sourceEventId: event.id,
          strategyApplicationId:
            evaluation.decisionType === 'READY_TO_RELEASE_ALLOWED_CARD' ? (next?.id ?? null) : null,
          decisionType: evaluation.decisionType,
          reasonCode: evaluation.reasonCode,
          policySnapshot: { rule, trigger },
          decidedByUserId: input.consultantId,
        },
      });
      if (evaluation.decisionType === 'INTERVENTION_REQUIRED')
        await tx.applicationSession.update({
          where: { id: session.id },
          data: {
            status: 'PAUSED',
            pauseReason: 'Consultant decision required',
            version: { increment: 1 },
          },
        });
      return {
        id: decision.id,
        decisionType: decision.decisionType,
        strategyApplicationId: decision.strategyApplicationId,
      } as Prisma.InputJsonObject;
    },
  });
}

export async function transitionSession(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    consultantId: string;
    action: 'PAUSE' | 'RESUME' | 'STOP' | 'END';
    reason?: string | undefined;
    expectedVersion: number;
    idempotencyKey: string;
  },
) {
  const session = await prisma.applicationSession.findFirst({
    where: { id: input.sessionId, consultantId: input.consultantId },
  });
  if (!session) throw new AppError('FORBIDDEN', 403, 'Session supervision is not permitted');
  if (input.action === 'RESUME') {
    await assertCurrentPreLiveConfirmation(prisma, session.id);
    await assertSupervised(prisma, session.id);
  }
  if (input.action === 'END') {
    const [unresolved, decision] = await Promise.all([
      prisma.creditApplication.findFirst({
        where: { sessionId: session.id, status: { in: ['RELEASED', 'OPENED'] } },
        select: { id: true },
      }),
      prisma.liveExecutionDecision.findFirst({
        where: { sessionId: session.id, current: true },
        select: { decisionType: true },
      }),
    ]);
    if (unresolved || decision?.decisionType !== 'END_SESSION_READY')
      throw new AppError(
        'SESSION_END_NOT_READY',
        409,
        'The frozen execution policy has not completed the session',
      );
  }
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'session',
      subjectId: session.id,
      operation: `session.${input.action.toLowerCase()}`,
      key: input.idempotencyKey,
      requestHash: hash({
        action: input.action,
        reason: input.reason,
        expectedVersion: input.expectedVersion,
      }),
    },
    audit: (result) => ({
      action: `APPLICATION_SESSION_${input.action}`,
      entityType: 'ApplicationSession',
      entityId: session.id,
      clientId: session.clientId,
      actorId: input.consultantId,
      metadata: result,
    }),
    outbox: {
      eventType: `session.${input.action.toLowerCase()}`,
      eventKey: `session:${session.id}:${input.action}:${input.idempotencyKey}`,
      aggregateType: 'ApplicationSession',
      aggregateId: session.id,
      payload: { clientId: session.clientId, domains: ['live-session'], sessionId: session.id },
    },
    mutate: async (tx) => {
      const updated = await tx.applicationSession.updateMany({
        where: {
          id: session.id,
          version: input.expectedVersion,
          ...(input.action === 'END' ? { status: { not: 'ENDED' } } : {}),
        },
        data: {
          status:
            input.action === 'RESUME'
              ? 'LIVE'
              : input.action === 'END' || input.action === 'STOP'
                ? 'ENDED'
                : 'PAUSED',
          pauseReason: input.action === 'PAUSE' ? (input.reason ?? 'Paused by consultant') : null,
          endedAt: input.action === 'END' || input.action === 'STOP' ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new AppError(
          'SESSION_VERSION_CONFLICT',
          409,
          'Session state changed; refetch before retrying',
        );
      return {
        id: session.id,
        status:
          input.action === 'RESUME'
            ? 'LIVE'
            : input.action === 'END' || input.action === 'STOP'
              ? 'ENDED'
              : 'PAUSED',
        version: input.expectedVersion + 1,
      } as Prisma.InputJsonObject;
    },
  });
}
