import type { PrismaClient } from '../generated/prisma/client.js';
import type { GoalRecord, GoalStore } from './types.js';
const toRecord = (goal: {
  id: string;
  clientId: string;
  goalType: GoalRecord['goalType'];
  scope: GoalRecord['scope'];
  targetAmount: { toNumber(): number } | null;
  currentAmount: { toNumber(): number } | null;
  allowAnnualFee: boolean;
  priority: GoalRecord['priority'];
  status: GoalRecord['status'];
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): GoalRecord => ({
  ...goal,
  targetAmount: goal.targetAmount?.toNumber() ?? null,
  currentAmount: goal.currentAmount?.toNumber() ?? null,
});
export function createPrismaGoalStore(prisma: PrismaClient): GoalStore {
  return {
    async list(clientId) {
      return (
        await prisma.clientGoal.findMany({
          where: { clientId },
          orderBy: [{ status: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
        })
      ).map(toRecord);
    },
    async create(clientId, input) {
      return prisma.$transaction(async (tx) => {
        if (input.priority === 'PRIMARY')
          await tx.clientGoal.updateMany({
            where: { clientId, status: 'ACTIVE', priority: 'PRIMARY' },
            data: { priority: 'SECONDARY' },
          });
        return toRecord(
          await tx.clientGoal.create({
            data: {
              clientId,
              goalType: input.goalType,
              scope: input.scope,
              priority: input.priority,
              ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
              ...(input.allowAnnualFee !== undefined ? { allowAnnualFee: input.allowAnnualFee } : {}),
            },
          }),
        );
      });
    },
    async update(clientId, goalId, input) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.clientGoal.findFirst({ where: { id: goalId, clientId } });
        if (!existing) return null;
        if (input.priority === 'PRIMARY')
          await tx.clientGoal.updateMany({
            where: { clientId, id: { not: goalId }, status: 'ACTIVE', priority: 'PRIMARY' },
            data: { priority: 'SECONDARY' },
          });
        const data = {
          ...(input.goalType !== undefined ? { goalType: input.goalType } : {}),
          ...(input.scope !== undefined ? { scope: input.scope } : {}),
          ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
          ...(input.allowAnnualFee !== undefined ? { allowAnnualFee: input.allowAnnualFee } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        };
        return toRecord(await tx.clientGoal.update({ where: { id: goalId }, data }));
      });
    },
    async archive(clientId, goalId) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.clientGoal.findFirst({ where: { id: goalId, clientId } });
        if (!existing) return null;
        const archived = await tx.clientGoal.update({
          where: { id: goalId },
          data: { status: 'PAUSED' },
        });
        if (existing.priority === 'PRIMARY') {
          const replacement = await tx.clientGoal.findFirst({
            where: { clientId, id: { not: goalId }, status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
          });
          if (replacement)
            await tx.clientGoal.update({
              where: { id: replacement.id },
              data: { priority: 'PRIMARY' },
            });
        }
        return toRecord(archived);
      });
    },
  };
}
