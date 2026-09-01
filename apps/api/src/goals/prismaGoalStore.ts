import type { ClientGoal, Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import type { GoalRecord, GoalStore } from './types.js';

const toRecord = (goal: ClientGoal): GoalRecord => ({
  ...goal,
  targetAmount: goal.targetAmount?.toNumber() ?? null,
  currentAmount: goal.currentAmount?.toNumber() ?? null,
});

async function appendRevision(
  tx: Prisma.TransactionClient,
  goal: ClientGoal,
  actorId: string | null,
  source = 'CLIENT_COMMAND',
) {
  await tx.clientGoalRevision.create({
    data: {
      goalId: goal.id,
      clientId: goal.clientId,
      version: goal.version,
      goalType: goal.goalType,
      scope: goal.scope,
      targetAmount: goal.targetAmount,
      allowAnnualFee: goal.allowAnnualFee,
      priority: goal.priority,
      status: goal.status,
      changedById: actorId,
      changeSource: source,
    },
  });
}

const payload = (clientId: string) =>
  ({ clientId, domains: ['goals'], refetch: true, reassessmentRequired: true }) as const;

const defined = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

export function createPrismaGoalStore(prisma: PrismaClient): GoalStore {
  const fetch = async (id: string) =>
    toRecord(await prisma.clientGoal.findUniqueOrThrow({ where: { id } }));
  return {
    async list(clientId) {
      return (
        await prisma.clientGoal.findMany({
          where: { clientId },
          orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        })
      ).map(toRecord);
    },
    async create(clientId, input, context) {
      if (!context) {
        const goal = await prisma.$transaction(async (tx) => {
          if (input.priority === 'PRIMARY')
            await tx.clientGoal.updateMany({
              where: { clientId, status: 'ACTIVE', priority: 'PRIMARY' },
              data: { priority: 'SECONDARY' },
            });
          const created = await tx.clientGoal.create({
            data: defined({ clientId, ...input }) as Prisma.ClientGoalUncheckedCreateInput,
          });
          await appendRevision(tx, created, null);
          return created;
        });
        return toRecord(goal);
      }
      const command = await executeConsequentialCommand(prisma, {
        idempotency: {
          scope: 'CLIENT_GOAL',
          subjectId: clientId,
          operation: 'CREATE',
          key: context.idempotencyKey,
          requestHash: context.requestHash,
        },
        mutate: async (tx) => {
          if (input.priority === 'PRIMARY')
            await tx.clientGoal.updateMany({
              where: { clientId, status: 'ACTIVE', priority: 'PRIMARY' },
              data: { priority: 'SECONDARY' },
            });
          const goal = await tx.clientGoal.create({
            data: defined({ clientId, ...input }) as Prisma.ClientGoalUncheckedCreateInput,
          });
          await appendRevision(tx, goal, context.actorId);
          return { goalId: goal.id, version: goal.version };
        },
        audit: (result) => ({
          actorId: context.actorId,
          clientId,
          action: 'CLIENT_GOAL_CREATED',
          entityType: 'ClientGoal',
          entityId: result.goalId,
          correlationId: context.idempotencyKey,
          metadata: { version: result.version },
        }),
        outbox: {
          eventType: 'client.goal.changed',
          eventKey: `goal-created:${clientId}:${context.idempotencyKey}`,
          aggregateType: 'ClientGoal',
          aggregateId: (result) => result.goalId,
          payload: payload(clientId),
        },
      });
      return fetch(command.result.goalId);
    },
    async update(clientId, goalId, input, context) {
      const { version, ...changes } = input;
      if (!context || version === undefined) {
        const existing = await prisma.clientGoal.findFirst({ where: { id: goalId, clientId } });
        if (!existing) return null;
        const goal = await prisma.$transaction(async (tx) => {
          const updated = await tx.clientGoal.update({
            where: { id: goalId },
            data: { ...defined(changes), version: { increment: 1 } },
          });
          await appendRevision(tx, updated, context?.actorId ?? null);
          return updated;
        });
        return toRecord(goal);
      }
      const command = await executeConsequentialCommand(prisma, {
        idempotency: {
          scope: 'CLIENT_GOAL',
          subjectId: clientId,
          operation: `UPDATE:${goalId}`,
          key: context.idempotencyKey,
          requestHash: context.requestHash,
        },
        mutate: async (tx) => {
          if (changes.priority === 'PRIMARY') {
            await tx.clientGoal.updateMany({
              where: { clientId, id: { not: goalId }, status: 'ACTIVE', priority: 'PRIMARY' },
              data: { priority: 'SECONDARY', version: { increment: 1 } },
            });
          }
          const changed = await tx.clientGoal.updateMany({
            where: { id: goalId, clientId, version },
            data: { ...defined(changes), version: { increment: 1 } },
          });
          if (!changed.count)
            throw new AppError(
              'STALE_OR_NOT_FOUND',
              409,
              'Goal changed elsewhere or is unavailable',
            );
          const goal = await tx.clientGoal.findUniqueOrThrow({ where: { id: goalId } });
          await appendRevision(tx, goal, context.actorId);
          return { goalId: goal.id, version: goal.version };
        },
        audit: (result) => ({
          actorId: context.actorId,
          clientId,
          action: 'CLIENT_GOAL_UPDATED',
          entityType: 'ClientGoal',
          entityId: result.goalId,
          correlationId: context.idempotencyKey,
          metadata: { version: result.version, reassessmentRequired: true },
        }),
        outbox: {
          eventType: 'client.goal.changed',
          eventKey: `goal-updated:${goalId}:${context.idempotencyKey}`,
          aggregateType: 'ClientGoal',
          aggregateId: goalId,
          payload: payload(clientId),
        },
      });
      return fetch(command.result.goalId);
    },
    async archive(clientId, goalId, context) {
      const existing = await prisma.clientGoal.findFirst({ where: { id: goalId, clientId } });
      if (!existing) return null;
      const apply = async (tx: Prisma.TransactionClient) => {
        const goal = await tx.clientGoal.update({
          where: { id: goalId },
          data: { status: 'PAUSED', version: { increment: 1 } },
        });
        await appendRevision(tx, goal, context?.actorId ?? null);
        return goal;
      };
      if (!context) return toRecord(await prisma.$transaction(apply));
      const command = await executeConsequentialCommand(prisma, {
        idempotency: {
          scope: 'CLIENT_GOAL',
          subjectId: clientId,
          operation: `ARCHIVE:${goalId}`,
          key: context.idempotencyKey,
          requestHash: context.requestHash,
        },
        mutate: async (tx) => {
          const goal = await apply(tx);
          return { goalId: goal.id, version: goal.version };
        },
        audit: (result) => ({
          actorId: context.actorId,
          clientId,
          action: 'CLIENT_GOAL_PAUSED',
          entityType: 'ClientGoal',
          entityId: result.goalId,
          correlationId: context.idempotencyKey,
        }),
        outbox: {
          eventType: 'client.goal.changed',
          eventKey: `goal-paused:${goalId}:${context.idempotencyKey}`,
          aggregateType: 'ClientGoal',
          aggregateId: goalId,
          payload: payload(clientId),
        },
      });
      return fetch(command.result.goalId);
    },
  };
}
