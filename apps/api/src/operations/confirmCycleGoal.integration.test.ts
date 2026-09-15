import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { confirmCycleGoal } from './confirmCycleGoal.js';
const prisma = createPrisma(process.env.DATABASE_URL!);
const users: string[] = [];
const clients: { id: string; userId: string }[] = [];
async function fixture() {
  const user = await prisma.user.create({
    data: { email: `goal-confirm-${randomUUID()}@example.test`, role: 'CLIENT', status: 'ACTIVE' },
  });
  users.push(user.id);
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      firstName: 'Synthetic',
      lastName: 'Cycle test',
      termsAcceptedAt: new Date(),
    },
  });
  clients.push({ id: client.id, userId: user.id });
  const goal = await prisma.clientGoal.create({
    data: {
      clientId: client.id,
      goalType: 'TOTAL_AVAILABLE_CREDIT',
      scope: 'PERSONAL',
      targetAmount: 50000,
      priority: 'PRIMARY',
    },
  });
  const journey = await prisma.creditJourney.create({ data: { clientId: client.id } });
  const cycle = await prisma.applicationCycle.create({
    data: {
      clientId: client.id,
      journeyId: journey.id,
      cycleNumber: 1,
      goalSnapshot: {
        create: {
          sourceGoalId: goal.id,
          sourceGoalVersion: 1,
          goalType: goal.goalType,
          scope: goal.scope,
          targetAmount: 50000,
          allowAnnualFee: goal.allowAnnualFee,
          cardTypePreference: goal.cardTypePreference,
          offerPreferences: goal.offerPreferences,
          feePreference: goal.feePreference,
        },
      },
      steps: {
        create: [
          { stage: 'STARTED', title: 'Goal', sortOrder: 0, status: 'AVAILABLE' },
          { stage: 'REVIEW_PURCHASE', title: 'Review', sortOrder: 1 },
        ],
      },
    },
  });
  return {
    goal,
    cycle,
    input: {
      clientId: client.id,
      actorId: user.id,
      cycleId: cycle.id,
      goalId: goal.id,
      goalVersion: 1,
    },
  };
}
afterAll(async () => {
  for (const client of clients) {
    await prisma.auditEvent.deleteMany({ where: { clientId: client.id } });
    await prisma.cycleGoalSnapshot.deleteMany({ where: { cycle: { clientId: client.id } } });
    await prisma.applicationCycle.deleteMany({ where: { clientId: client.id } });
    await prisma.creditJourney.deleteMany({ where: { clientId: client.id } });
    await prisma.clientGoal.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
test('rejects stale goals and captures the reviewed revision atomically', async () => {
  const { input, goal, cycle } = await fixture();
  await prisma.clientGoal.update({
    where: { id: goal.id },
    data: { version: 2, targetAmount: 75000, preferenceNote: 'Reviewed change' },
  });
  await expect(confirmCycleGoal(prisma, input)).rejects.toMatchObject({ code: 'CYCLE_GOAL_STALE' });
  expect(await prisma.auditEvent.count({ where: { clientId: input.clientId } })).toBe(0);
  expect(
    (await prisma.applicationCycle.findUniqueOrThrow({ where: { id: cycle.id } })).goalConfirmedAt,
  ).toBeNull();
  await confirmCycleGoal(prisma, { ...input, goalVersion: 2 });
  const snapshot = await prisma.cycleGoalSnapshot.findUniqueOrThrow({
    where: { cycleId: cycle.id },
  });
  expect(snapshot.sourceGoalVersion).toBe(2);
  expect(Number(snapshot.targetAmount)).toBe(75000);
  expect(snapshot.preferenceNote).toBe('Reviewed change');
});
test('concurrent retries create one audit and preserve confirmation history after later edits', async () => {
  const { input, goal, cycle } = await fixture();
  const outcomes = await Promise.all([
    confirmCycleGoal(prisma, input),
    confirmCycleGoal(prisma, input),
  ]);
  expect(outcomes.filter((x) => x.changed)).toHaveLength(1);
  const before = await prisma.applicationCycle.findUniqueOrThrow({
    where: { id: cycle.id },
    include: { goalSnapshot: true, steps: true },
  });
  await prisma.clientGoal.update({
    where: { id: goal.id },
    data: { version: 2, targetAmount: 90000 },
  });
  expect((await confirmCycleGoal(prisma, input)).changed).toBe(false);
  await expect(confirmCycleGoal(prisma, { ...input, goalVersion: 2 })).rejects.toMatchObject({
    code: 'CYCLE_GOAL_ALREADY_CONFIRMED',
  });
  const after = await prisma.applicationCycle.findUniqueOrThrow({
    where: { id: cycle.id },
    include: { goalSnapshot: true, steps: true },
  });
  expect(after).toEqual(before);
  expect(
    await prisma.auditEvent.count({
      where: { clientId: input.clientId, action: 'APPLICATION_CYCLE_GOAL_CONFIRMED' },
    }),
  ).toBe(1);
});
test('does not expose or alter another client cycle', async () => {
  const { input } = await fixture();
  await expect(
    confirmCycleGoal(prisma, { ...input, clientId: randomUUID() }),
  ).rejects.toMatchObject({ status: 404 });
});
test('preserves a seasonal cycle snapshot without legacy steps', async () => {
  const { input, cycle } = await fixture();
  await prisma.applicationCycleStep.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.applicationCycle.update({
    where: { id: cycle.id },
    data: { goalConfirmedAt: new Date() },
  });
  expect((await confirmCycleGoal(prisma, input)).changed).toBe(false);
  await expect(confirmCycleGoal(prisma, { ...input, goalVersion: 2 })).rejects.toMatchObject({
    code: 'CYCLE_GOAL_ALREADY_CONFIRMED',
  });
  expect(await prisma.auditEvent.count({ where: { clientId: input.clientId } })).toBe(0);
});
