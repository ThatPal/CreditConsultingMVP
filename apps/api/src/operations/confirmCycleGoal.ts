import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

export async function confirmCycleGoal(
  prisma: PrismaClient,
  input: {
    clientId: string;
    actorId: string;
    cycleId: string;
    goalId: string;
    goalVersion: number;
  },
) {
  return prisma.$transaction(async (tx) => {
    // Serialize confirmations before reading completion state or writing the audit.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ApplicationCycle"
      WHERE id = ${input.cycleId}::uuid AND "clientId" = ${input.clientId}::uuid
      FOR UPDATE`;
    if (!locked.length)
      throw new AppError('APPLICATION_CYCLE_NOT_FOUND', 404, 'Active application cycle not found');
    const cycle = await tx.applicationCycle.findUniqueOrThrow({
      where: { id: input.cycleId },
      include: { steps: true, goalSnapshot: true, _count: { select: { creditCardRounds: true } } },
    });
    if (cycle.status !== 'ACTIVE')
      throw new AppError('APPLICATION_CYCLE_NOT_FOUND', 404, 'Active application cycle not found');
    const step = cycle.steps.find((s) => s.stage === 'STARTED');
    const snapshot = cycle.goalSnapshot;
    if (cycle.goalConfirmedAt || step?.status === 'COMPLETE' || cycle._count.creditCardRounds > 0) {
      if (
        snapshot?.sourceGoalId !== input.goalId ||
        snapshot.sourceGoalVersion !== input.goalVersion
      )
        throw new AppError(
          'CYCLE_GOAL_ALREADY_CONFIRMED',
          409,
          'This cycle already has a confirmed goal. Its historical snapshot cannot be replaced.',
        );
      return {
        confirmed: true,
        cycleId: cycle.id,
        goalId: snapshot.sourceGoalId,
        goalVersion: snapshot.sourceGoalVersion,
        changed: false,
      };
    }
    if (!step)
      throw new AppError('GOAL_STEP_NOT_FOUND', 409, 'Goal confirmation step is unavailable');
    // Goal updates acquire the same row lock, so the revision cannot change
    // between validation and snapshot capture.
    await tx.$queryRaw`SELECT id FROM "ClientGoal" WHERE id = ${input.goalId}::uuid AND "clientId" = ${input.clientId}::uuid FOR UPDATE`;
    const goal = await tx.clientGoal.findFirst({
      where: {
        id: input.goalId,
        clientId: input.clientId,
        version: input.goalVersion,
        priority: 'PRIMARY',
        status: 'ACTIVE',
      },
    });
    if (!goal)
      throw new AppError(
        'CYCLE_GOAL_STALE',
        409,
        'Your goal changed before confirmation. Review the latest goal before continuing.',
      );
    const now = new Date();
    const data = {
      sourceGoalId: goal.id,
      sourceGoalVersion: goal.version,
      goalType: goal.goalType,
      scope: goal.scope,
      targetAmount: goal.targetAmount,
      allowAnnualFee: goal.allowAnnualFee,
      cardTypePreference: goal.cardTypePreference,
      offerPreferences: goal.offerPreferences,
      feePreference: goal.feePreference,
      preferenceNote: goal.preferenceNote,
      capturedAt: now,
    };
    await tx.cycleGoalSnapshot.upsert({
      where: { cycleId: cycle.id },
      create: { cycleId: cycle.id, ...data },
      update: data,
    });
    await tx.applicationCycleStep.update({
      where: { id: step.id },
      data: { status: 'COMPLETE', completedAt: now, sourceType: 'ClientGoal', sourceId: goal.id },
    });
    const next = cycle.steps.find((s) => s.stage === 'REVIEW_PURCHASE');
    if (next)
      await tx.applicationCycleStep.update({
        where: { id: next.id },
        data: { status: 'AVAILABLE', startedAt: now },
      });
    await tx.applicationCycle.update({
      where: { id: cycle.id },
      data: { currentStage: 'REVIEW_PURCHASE', goalConfirmedAt: now },
    });
    await tx.auditEvent.create({
      data: {
        clientId: input.clientId,
        actorId: input.actorId,
        action: 'APPLICATION_CYCLE_GOAL_CONFIRMED',
        entityType: 'ApplicationCycle',
        entityId: cycle.id,
        metadata: {
          goalId: goal.id,
          goalVersion: goal.version,
          goalType: goal.goalType,
          targetAmount: goal.targetAmount,
          allowAnnualFee: goal.allowAnnualFee,
        },
      },
    });
    return {
      confirmed: true,
      cycleId: cycle.id,
      goalId: goal.id,
      goalVersion: goal.version,
      changed: true,
    };
  });
}
