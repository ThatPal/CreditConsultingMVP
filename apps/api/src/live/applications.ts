import { createHash } from 'node:crypto';
import {
  Prisma,
  type CreditApplicationOutcome,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { assertCurrentPreLiveConfirmation } from './confirmations.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function knownApprovedAmount(
  outcome: CreditApplicationOutcome,
  approvedLimitKnown?: boolean,
  approvedLimit?: number,
) {
  return outcome === 'APPROVED' && approvedLimitKnown && approvedLimit && approvedLimit > 0
    ? approvedLimit
    : 0;
}

async function assertSupervised(
  prisma: PrismaClient | Prisma.TransactionClient,
  sessionId: string,
) {
  const active = await prisma.sessionPresenceLease.groupBy({
    by: ['role'],
    where: { sessionId, expiresAt: { gt: new Date() } },
    _count: true,
  });
  if (
    !active.some((item) => item.role === 'CLIENT' && item._count > 0) ||
    !active.some((item) => item.role === 'CONSULTANT' && item._count > 0)
  )
    throw new AppError(
      'SUPERVISION_REQUIRED',
      409,
      'Current client and consultant presence is required',
    );
}

export async function releaseApplication(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    strategyApplicationId: string;
    consultantId: string;
    idempotencyKey: string;
  },
) {
  const session = await prisma.applicationSession.findFirst({
    where: { id: input.sessionId, consultantId: input.consultantId },
  });
  if (!session) throw new AppError('FORBIDDEN', 403, 'Session supervision is not permitted');
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'session',
      subjectId: session.id,
      operation: 'application.release',
      key: input.idempotencyKey,
      requestHash: hash({ strategyApplicationId: input.strategyApplicationId }),
    },
    audit: (result) => ({
      action: 'CREDIT_APPLICATION_RELEASED',
      entityType: 'CreditApplication',
      entityId: String((result as { id: string }).id),
      clientId: session.clientId,
      actorId: input.consultantId,
    }),
    outbox: {
      eventType: 'application.released',
      eventKey: `session:${session.id}:release:${input.idempotencyKey}`,
      aggregateType: 'ApplicationSession',
      aggregateId: session.id,
      payload: (result) => ({
        clientId: session.clientId,
        domains: ['live-session'],
        sessionId: session.id,
        applicationId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const current = await tx.applicationSession.findUnique({ where: { id: session.id } });
      if (!current || current.status !== 'LIVE')
        throw new AppError('SESSION_NOT_LIVE', 409, 'Session is not live');
      await assertSupervised(tx, session.id);
      await assertCurrentPreLiveConfirmation(tx, session.id);
      const unresolved = await tx.creditApplication.findFirst({
        where: { sessionId: session.id, status: { in: ['RELEASED', 'OPENED'] } },
      });
      if (unresolved)
        throw new AppError(
          'APPLICATION_UNRESOLVED',
          409,
          'Complete the current card before another release',
        );
      const occurrence = await tx.strategyApplication.findFirst({
        where: { id: input.strategyApplicationId, strategyVersionId: session.strategyVersionId },
        include: { candidate: true },
      });
      const decision = occurrence
        ? await tx.liveExecutionDecision.findFirst({
            where: {
              sessionId: session.id,
              current: true,
              decisionType: 'READY_TO_RELEASE_ALLOWED_CARD',
              strategyApplicationId: occurrence.id,
            },
          })
        : null;
      if (!occurrence || (occurrence.role !== 'PLANNED' && !decision))
        throw new AppError(
          'CARD_NOT_ALLOWED',
          409,
          'Card occurrence is not an allowed current Strategy card',
        );
      const earlier =
        occurrence.role === 'PLANNED'
          ? await tx.strategyApplication.findFirst({
              where: {
                strategyVersionId: session.strategyVersionId,
                role: 'PLANNED',
                sequence: { lt: occurrence.sequence },
                NOT: {
                  id: {
                    in: (
                      await tx.creditApplication.findMany({
                        where: { sessionId: session.id },
                        select: { strategyApplicationId: true },
                      })
                    ).map((item) => item.strategyApplicationId),
                  },
                },
              },
            })
          : null;
      if (earlier)
        throw new AppError(
          'CARD_OUT_OF_SEQUENCE',
          409,
          'An earlier approved Strategy card must be handled first',
        );
      const application = await tx.creditApplication.create({
        data: {
          sessionId: session.id,
          clientId: session.clientId,
          roundId: session.roundId,
          strategyVersionId: session.strategyVersionId,
          strategyApplicationId: occurrence.id,
          productId: occurrence.candidate.productId,
          offerVersionId: occurrence.candidate.offerVersionId,
        },
      });
      await tx.creditApplicationEvent.create({
        data: {
          applicationId: application.id,
          sessionId: session.id,
          actorUserId: input.consultantId,
          eventType: 'RELEASED',
          payload: {},
        },
      });
      if (decision)
        await tx.liveExecutionDecision.update({
          where: { id: decision.id },
          data: { current: false, supersededAt: new Date() },
        });
      return { id: application.id, status: application.status } as Prisma.InputJsonObject;
    },
  });
}

export async function currentReleasedApplication(
  prisma: PrismaClient,
  sessionId: string,
  clientId: string,
) {
  const application = await prisma.creditApplication.findFirst({
    where: { sessionId, clientId, status: { in: ['RELEASED', 'OPENED'] } },
    orderBy: [{ releasedAt: 'desc' }, { id: 'desc' }],
  });
  if (!application) return null;
  const [product, offer, occurrence] = await Promise.all([
    prisma.cardProduct.findUnique({
      where: { id: application.productId },
      select: { displayName: true, slug: true },
    }),
    prisma.cardOfferVersion.findUnique({
      where: { id: application.offerVersionId },
      select: { facts: true },
    }),
    prisma.strategyApplication.findUnique({
      where: { id: application.strategyApplicationId },
      select: { clientSafeReason: true },
    }),
  ]);
  return {
    id: application.id,
    status: application.status,
    product: product ? { displayName: product.displayName, slug: product.slug } : null,
    offerFacts: offer?.facts ?? null,
    whyThisCard: occurrence?.clientSafeReason ?? null,
    allowedActions: ['OPEN', 'SKIP', 'HELP'],
  };
}

export async function applyApplicationAction(
  prisma: PrismaClient,
  input: {
    applicationId: string;
    clientId: string;
    actorId: string;
    action: 'OPEN' | 'SKIP' | 'HELP';
    idempotencyKey: string;
  },
) {
  const application = await prisma.creditApplication.findFirst({
    where: { id: input.applicationId, clientId: input.clientId },
  });
  if (!application)
    throw new AppError('APPLICATION_NOT_FOUND', 404, 'Released application was not found');
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'application',
      subjectId: application.id,
      operation: `application.${input.action.toLowerCase()}`,
      key: input.idempotencyKey,
      requestHash: hash({ action: input.action }),
    },
    audit: {
      action: `CREDIT_APPLICATION_${input.action}`,
      entityType: 'CreditApplication',
      entityId: application.id,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: `application.${input.action.toLowerCase()}`,
      eventKey: `application:${application.id}:${input.action}:${input.idempotencyKey}`,
      aggregateType: 'CreditApplication',
      aggregateId: application.id,
      payload: {
        clientId: input.clientId,
        domains: ['live-session'],
        sessionId: application.sessionId,
        applicationId: application.id,
      },
    },
    mutate: async (tx) => {
      if (input.action === 'HELP') {
        const existing = await tx.workItem.findFirst({
          where: { dedupeKey: `session-help:${application.sessionId}`, status: 'OPEN' },
        });
        if (!existing)
          await tx.workItem.create({
            data: {
              clientId: input.clientId,
              title: 'Client needs live-session help',
              domain: 'LIVE_SESSION',
              priority: 'URGENT',
              authority: 'ATTENTION_PROJECTION',
              sourceType: 'ApplicationSession',
              sourceId: application.sessionId,
              reasonCode: 'SESSION_HELP_REQUESTED',
              dedupeKey: `session-help:${application.sessionId}`,
              deepLink: { route: `/crm/live-sessions/${application.sessionId}` },
              neededSince: new Date(),
            },
          });
        return {
          id: application.id,
          status: application.status,
          helpRequested: true,
        } as Prisma.InputJsonObject;
      }
      if (application.status !== 'RELEASED')
        throw new AppError(
          'APPLICATION_ACTION_STALE',
          409,
          'Released application has already changed',
        );
      const status = input.action === 'SKIP' ? 'SKIPPED' : 'OPENED';
      const updated = await tx.creditApplication.update({
        where: { id: application.id },
        data: {
          status,
          ...(input.action === 'OPEN' ? { openedAt: new Date() } : {}),
          version: { increment: 1 },
        },
      });
      await tx.creditApplicationEvent.create({
        data: {
          applicationId: application.id,
          sessionId: application.sessionId,
          actorUserId: input.actorId,
          eventType: input.action === 'SKIP' ? 'SKIPPED' : 'OPENED',
          payload: {},
        },
      });
      return { id: updated.id, status: updated.status } as Prisma.InputJsonObject;
    },
  });
}

export async function recordApplicationResult(
  prisma: PrismaClient,
  input: {
    applicationId: string;
    clientId: string;
    actorId: string;
    outcome: CreditApplicationOutcome;
    approvedLimitKnown?: boolean | undefined;
    approvedLimit?: number | undefined;
    issuerReason?: string | undefined;
    idempotencyKey: string;
  },
) {
  if (
    input.outcome === 'APPROVED' &&
    input.approvedLimitKnown &&
    !(input.approvedLimit && input.approvedLimit > 0)
  )
    throw new AppError('APPROVED_LIMIT_REQUIRED', 400, 'Enter the known approved limit');
  const application = await prisma.creditApplication.findFirst({
    where: { id: input.applicationId, clientId: input.clientId },
  });
  if (!application) throw new AppError('APPLICATION_NOT_FOUND', 404, 'Application was not found');
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'application',
      subjectId: application.id,
      operation: 'application.result',
      key: input.idempotencyKey,
      requestHash: hash(input),
    },
    audit: {
      action: 'CREDIT_APPLICATION_RESULT_RECORDED',
      entityType: 'CreditApplication',
      entityId: application.id,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'application.result-recorded',
      eventKey: `application:${application.id}:result:${input.idempotencyKey}`,
      aggregateType: 'CreditApplication',
      aggregateId: application.id,
      payload: {
        clientId: input.clientId,
        domains: ['live-session', 'round'],
        sessionId: application.sessionId,
        applicationId: application.id,
      },
    },
    mutate: async (tx) => {
      const current = await tx.creditApplication.findUnique({ where: { id: application.id } });
      if (!current || current.status !== 'OPENED')
        throw new AppError('APPLICATION_RESULT_STALE', 409, 'Application is not awaiting a result');
      const updated = await tx.creditApplication.update({
        where: { id: current.id },
        data: {
          status: 'RESULT_RECORDED',
          outcome: input.outcome,
          approvedLimitKnown:
            input.outcome === 'APPROVED' ? Boolean(input.approvedLimitKnown) : null,
          approvedLimit:
            input.outcome === 'APPROVED' && input.approvedLimitKnown
              ? (input.approvedLimit ?? null)
              : null,
          issuerReason: input.issuerReason ?? null,
          resultRecordedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.creditApplicationEvent.create({
        data: {
          applicationId: current.id,
          sessionId: current.sessionId,
          actorUserId: input.actorId,
          eventType: 'RESULT_RECORDED',
          outcome: input.outcome,
          payload: {
            approvedLimitKnown: updated.approvedLimitKnown,
            approvedLimit: updated.approvedLimit?.toString() ?? null,
          },
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        outcome: updated.outcome,
        approvedLimitKnown: updated.approvedLimitKnown,
        approvedLimit: updated.approvedLimit?.toString() ?? null,
      } as Prisma.InputJsonObject;
    },
  });
}
