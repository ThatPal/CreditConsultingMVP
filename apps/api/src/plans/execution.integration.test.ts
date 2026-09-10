import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { getClientPlan } from './service.js';
import {
  approvePlan,
  createPlanDraft,
  executePlanItem,
  getPlanBuilder,
  verifyPlanItem,
  type PlanDraftInput,
} from './service.js';

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
    clientUserId = (
      await prisma.user.create({
        data: { email: `${marker}-client@example.test`, role: 'CLIENT', status: 'ACTIVE' },
      })
    ).id;
    consultantId = (
      await prisma.user.create({
        data: { email: `${marker}-consultant@example.test`, role: 'CONSULTANT', status: 'ACTIVE' },
      })
    ).id;
    clientId = (
      await prisma.client.create({
        data: {
          userId: clientUserId,
          firstName: marker,
          lastName: 'Client',
          termsAcceptedAt: new Date(),
          assignedConsultantId: consultantId,
        },
      })
    ).id;
    const draft: PlanDraftInput = {
      title: 'Execution proof',
      purpose: 'PREPARATION',
      items: [
        {
          stableKey: 'guide',
          type: 'GUIDANCE',
          completionMode: 'ACKNOWLEDGEMENT',
          owner: 'CLIENT',
          clientTitle: 'Read guidance',
          sortOrder: 0,
        },
        {
          stableKey: 'outcome',
          type: 'ACTION',
          completionMode: 'STRUCTURED_OUTCOME',
          owner: 'CLIENT',
          clientTitle: 'Report balance',
          outcomeSchema: {
            type: 'object',
            properties: { balance: { type: 'number', minimum: 0 } },
            required: ['balance'],
          },
          sortOrder: 1,
        },
        {
          stableKey: 'milestone',
          type: 'MILESTONE',
          completionMode: 'CONSULTANT_VERIFY',
          owner: 'CONSULTANT',
          clientTitle: 'Verify readiness',
          sortOrder: 2,
        },
        {
          stableKey: 'help',
          type: 'ACTION',
          completionMode: 'ACKNOWLEDGEMENT',
          owner: 'CLIENT',
          clientTitle: 'Optional preparation step',
          sortOrder: 3,
          required: false,
        },
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
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { not: null }, payload: { path: ['clientId'], equals: clientId } },
    });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.planItemOutcome.deleteMany({
      where: { planItem: { planVersion: { plan: { clientId } } } },
    });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, consultantId] } } });
    await prisma.$disconnect();
  });

  test('enforces prerequisites and records duplicate-safe structured domain outcomes', async () => {
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: actionId,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
        outcome: { balance: 1200 },
      }),
    ).rejects.toMatchObject({ code: 'PLAN_ITEM_LOCKED' });
    const key = randomUUID();
    const first = await executePlanItem(prisma, {
      clientId,
      itemId: guideId,
      actorId: clientUserId,
      idempotencyKey: key,
      action: 'COMPLETE',
    });
    const replay = await executePlanItem(prisma, {
      clientId,
      itemId: guideId,
      actorId: clientUserId,
      idempotencyKey: key,
      action: 'COMPLETE',
    });
    expect(replay).toEqual({ replayed: true, outcomeId: first.outcomeId });
    await expect(
      executePlanItem(prisma, {
        clientId: randomUUID(),
        itemId: guideId,
        actorId: clientUserId,
        idempotencyKey: key,
        action: 'COMPLETE',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: actionId } })).toMatchObject({
      status: 'AVAILABLE',
    });
    const outcomeKey = randomUUID();
    await executePlanItem(prisma, {
      clientId,
      itemId: actionId,
      actorId: clientUserId,
      idempotencyKey: outcomeKey,
      action: 'COMPLETE',
      outcome: { balance: 1200 },
    });
    await executePlanItem(prisma, {
      clientId,
      itemId: actionId,
      actorId: clientUserId,
      idempotencyKey: outcomeKey,
      action: 'COMPLETE',
      outcome: { balance: 1200 },
    });
    expect(
      await prisma.planItemOutcome.count({
        where: { planItemId: actionId, idempotencyKey: outcomeKey },
      }),
    ).toBe(1);
    expect(
      await prisma.clientUpdate.count({
        where: { clientId, sourceKey: { startsWith: 'plan-outcome:' } },
      }),
    ).toBe(1);
    expect(await prisma.auditEvent.count({ where: { clientId, correlationId: outcomeKey } })).toBe(
      1,
    );
    expect(
      await prisma.outboxEvent.count({
        where: { eventKey: `plan-item:${actionId}:${outcomeKey}` },
      }),
    ).toBe(1);
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: milestoneId } })).toMatchObject({
      status: 'AVAILABLE',
    });
  });

  test('prevents client milestone completion and permits governed consultant verification', async () => {
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: milestoneId,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_ITEM_VERIFICATION_REQUIRED' });
    await expect(
      verifyPlanItem(prisma, clientId, milestoneId, consultantId),
    ).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  test('retains correction history and unlocks dependencies only after verification', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Response review',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'report',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Describe the update',
          sortOrder: 0,
        },
        {
          stableKey: 'next',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Next preparation',
          sortOrder: 1,
        },
      ],
      dependencies: [{ dependentKey: 'next', prerequisiteKey: 'report' }],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const items = (await getClientPlan(prisma, clientId)).plan!.version.items;
    const report = items.find((item) => item.stableKey === 'report')!;
    const next = items.find((item) => item.stableKey === 'next')!;
    await expect(verifyPlanItem(prisma, clientId, report.id, consultantId)).rejects.toMatchObject({
      code: 'INVALID_PLAN_ITEM_STATE',
    });
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: report.id,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
        outcome: {},
      }),
    ).rejects.toMatchObject({ code: 'PLAN_RESPONSE_INVALID' });
    const first = await executePlanItem(prisma, {
      clientId,
      itemId: report.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE',
      outcome: { clientReport: 'First response' },
    });
    await verifyPlanItem(prisma, clientId, report.id, consultantId, {
      decision: 'RETURN',
      expectedOutcomeId: first.outcomeId,
      note: 'Please include the report date.',
    });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: report.id } })).toMatchObject({
      status: 'IN_PROGRESS',
      completedAt: null,
    });
    const key = randomUUID();
    const submissions = await Promise.all(
      [1, 2].map(() =>
        executePlanItem(prisma, {
          clientId,
          itemId: report.id,
          actorId: clientUserId,
          idempotencyKey: key,
          action: 'COMPLETE',
          outcome: { clientReport: 'Report dated September 10' },
        }),
      ),
    );
    expect(new Set(submissions.map((row) => row.outcomeId)).size).toBe(1);
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({
      status: 'LOCKED',
    });
    await expect(
      verifyPlanItem(prisma, clientId, report.id, consultantId, {
        decision: 'VERIFY',
        expectedOutcomeId: first.outcomeId,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_EVIDENCE_CHANGED' });
    await verifyPlanItem(prisma, clientId, report.id, consultantId, {
      decision: 'VERIFY',
      expectedOutcomeId: submissions[0]!.outcomeId,
      note: 'Report date confirmed.',
    });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({
      status: 'AVAILABLE',
    });
    const final = (await getClientPlan(prisma, clientId)).plan!.version.items.find(
      (item) => item.id === report.id,
    )!;
    expect(final.history.map((entry) => entry.kind)).toEqual([
      'COMPLETE',
      'CORRECTION_REQUESTED',
      'COMPLETE',
      'VERIFIED',
    ]);
    expect(final.responseForm.fields[0]).toMatchObject({ key: 'clientReport', required: true });
    expect(
      await prisma.workItem.count({
        where: { sourceId: report.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      }),
    ).toBe(0);
  });

  test('records unable state and one meaningful Attention projection without false completion', async () => {
    const key = randomUUID();
    await executePlanItem(prisma, {
      clientId,
      itemId: helpId,
      actorId: clientUserId,
      idempotencyKey: key,
      action: 'UNABLE',
      reason: 'Need consultant help',
    });
    await executePlanItem(prisma, {
      clientId,
      itemId: helpId,
      actorId: clientUserId,
      idempotencyKey: key,
      action: 'UNABLE',
      reason: 'Need consultant help',
    });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: helpId } })).toMatchObject({
      status: 'UNABLE',
      completedAt: null,
    });
    expect(
      await prisma.workItem.count({
        where: { sourceType: 'PlanItem', sourceId: helpId, reasonCode: 'UNABLE' },
      }),
    ).toBe(1);
  });
});
