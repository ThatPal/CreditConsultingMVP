import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { approvePlan, createPlanDraft, executePlanItem, getPlanBuilder, verifyPlanItem, type PlanDraftInput } from './service.js';

describe('consequential client Plan execution', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
  const marker = `execute-${randomUUID()}`;
  let clientId = '';
  let clientUserId = '';
  let consultantId = '';
  let guideId = '';
  let actionId = '';
  let milestoneId = '';
  let helpId = '';
  beforeAll(async () => {
    await prisma.$connect();
    clientUserId = (await prisma.user.create({ data: { email: `${marker}-client@example.test`, role: 'CLIENT', status: 'ACTIVE' } })).id;
    consultantId = (await prisma.user.create({ data: { email: `${marker}-consultant@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } })).id;
    clientId = (await prisma.client.create({ data: { userId: clientUserId, firstName: marker, lastName: 'Client', termsAcceptedAt: new Date(), assignedConsultantId: consultantId } })).id;
    const draft: PlanDraftInput = {
      title: 'Execution proof', purpose: 'PREPARATION', items: [
        { stableKey: 'guide', type: 'GUIDANCE', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Read guidance', sortOrder: 0 },
        { stableKey: 'outcome', type: 'ACTION', completionMode: 'STRUCTURED_OUTCOME', owner: 'CLIENT', clientTitle: 'Report balance', sortOrder: 1 },
        { stableKey: 'milestone', type: 'MILESTONE', completionMode: 'CONSULTANT_VERIFY', owner: 'CONSULTANT', clientTitle: 'Verify readiness', sortOrder: 2 },
        { stableKey: 'help', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Optional preparation step', sortOrder: 3, required: false },
      ],
      dependencies: [
        { dependentKey: 'outcome', prerequisiteKey: 'guide' },
        { dependentKey: 'milestone', prerequisiteKey: 'outcome' },
      ],
    };
    const created = await createPlanDraft(prisma, clientId, draft);
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const items = (await getPlanBuilder(prisma, clientId)).plan!.versions[0]!.items;
    guideId = items.find(({ stableKey }) => stableKey === 'guide')!.id;
    actionId = items.find(({ stableKey }) => stableKey === 'outcome')!.id;
    milestoneId = items.find(({ stableKey }) => stableKey === 'milestone')!.id;
    helpId = items.find(({ stableKey }) => stableKey === 'help')!.id;
  });
  afterAll(async () => {
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.clientUpdate.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { not: null }, payload: { path: ['clientId'], equals: clientId } } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.planItemOutcome.deleteMany({ where: { planItem: { planVersion: { plan: { clientId } } } } });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, consultantId] } } });
    await prisma.$disconnect();
  });

  test('enforces prerequisites and records duplicate-safe structured domain outcomes', async () => {
    await expect(executePlanItem(prisma, { clientId, itemId: actionId, actorId: clientUserId, idempotencyKey: randomUUID(), action: 'COMPLETE', outcome: { balance: 1200 } })).rejects.toMatchObject({ code: 'PLAN_ITEM_LOCKED' });
    const key = randomUUID();
    const first = await executePlanItem(prisma, { clientId, itemId: guideId, actorId: clientUserId, idempotencyKey: key, action: 'COMPLETE' });
    const replay = await executePlanItem(prisma, { clientId, itemId: guideId, actorId: clientUserId, idempotencyKey: key, action: 'COMPLETE' });
    expect(replay).toEqual({ replayed: true, outcomeId: first.outcomeId });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: actionId } })).toMatchObject({ status: 'AVAILABLE' });
    const outcomeKey = randomUUID();
    await executePlanItem(prisma, { clientId, itemId: actionId, actorId: clientUserId, idempotencyKey: outcomeKey, action: 'COMPLETE', outcome: { balance: 1200 } });
    await executePlanItem(prisma, { clientId, itemId: actionId, actorId: clientUserId, idempotencyKey: outcomeKey, action: 'COMPLETE', outcome: { balance: 1200 } });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: actionId, idempotencyKey: outcomeKey } })).toBe(1);
    expect(await prisma.clientUpdate.count({ where: { clientId, sourceKey: { startsWith: 'plan-outcome:' } } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { clientId, correlationId: outcomeKey } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { eventKey: `plan-item:${actionId}:${outcomeKey}` } })).toBe(1);
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: milestoneId } })).toMatchObject({ status: 'AVAILABLE' });
  });

  test('prevents client milestone completion and permits governed consultant verification', async () => {
    await expect(executePlanItem(prisma, { clientId, itemId: milestoneId, actorId: clientUserId, idempotencyKey: randomUUID(), action: 'COMPLETE' })).rejects.toMatchObject({ code: 'PLAN_ITEM_VERIFICATION_REQUIRED' });
    await expect(verifyPlanItem(prisma, clientId, milestoneId, consultantId)).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  test('records unable state and one meaningful Attention projection without false completion', async () => {
    const key = randomUUID();
    await executePlanItem(prisma, { clientId, itemId: helpId, actorId: clientUserId, idempotencyKey: key, action: 'UNABLE', reason: 'Need consultant help' });
    await executePlanItem(prisma, { clientId, itemId: helpId, actorId: clientUserId, idempotencyKey: key, action: 'UNABLE', reason: 'Need consultant help' });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: helpId } })).toMatchObject({ status: 'UNABLE', completedAt: null });
    expect(await prisma.workItem.count({ where: { sourceType: 'PlanItem', sourceId: helpId, reasonCode: 'UNABLE' } })).toBe(1);
  });
});
