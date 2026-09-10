import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import {
  approvePlan,
  createPlanDraft,
  executePlanItem,
  getClientPlan,
  getPlanBuilder,
  getPlanSourcePreview,
  reconcilePlanSources,
  revisePlanDraft,
  type PlanDraftInput,
} from './service.js';

describe('Astra Plan revision and source review', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.includes(':5445/credit_strategy_astra'))
    throw new Error('Astra test database required');
  const prisma = createPrisma(databaseUrl);
  const marker = `reconcile-${randomUUID()}`;
  let clientId = '',
    clientUserId = '',
    consultantId = '',
    planId = '',
    completedItemId = '',
    goalId = '';
  const original: PlanDraftInput = {
    title: 'Nurture preparation',
    purpose: 'NURTURE',
    items: [
      {
        stableKey: 'completed-guidance',
        type: 'GUIDANCE',
        completionMode: 'ACKNOWLEDGEMENT',
        owner: 'CLIENT',
        clientTitle: 'Protected approved guidance',
        consultantRationale: 'Manual rationale',
        manuallyProtected: true,
        sortOrder: 0,
      },
      {
        stableKey: 'future-action',
        type: 'ACTION',
        completionMode: 'ACKNOWLEDGEMENT',
        owner: 'CLIENT',
        clientTitle: 'Future action',
        sortOrder: 1,
      },
    ],
    dependencies: [{ dependentKey: 'future-action', prerequisiteKey: 'completed-guidance' }],
  };
  const builder = async () => (await getPlanBuilder(prisma, clientId)).plan!.versions[0]!;
  const payload = async (): Promise<PlanDraftInput> => {
    const version = await builder();
    return {
      ...original,
      title: version.title!,
      purpose: version.purpose!,
      sourceGoalRevisionId: version.sourceGoalRevisionId,
    };
  };
  const reconcile = async (reason: string) => {
    const preview = await getPlanSourcePreview(prisma, clientId, planId);
    return reconcilePlanSources(prisma, {
      clientId,
      planId,
      actorId: consultantId,
      expectedVersion: preview.expectedVersion,
      expectedSourceFingerprint: preview.fingerprint,
      reason,
    });
  };
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
    planId = (await createPlanDraft(prisma, clientId, original)).planId;
    await approvePlan(prisma, clientId, planId, consultantId);
    completedItemId = (await builder()).items.find(
      (item) => item.stableKey === 'completed-guidance',
    )!.id;
    await executePlanItem(prisma, {
      clientId,
      itemId: completedItemId,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE',
    });
  });
  afterAll(async () => {
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({
      where: { payload: { path: ['clientId'], equals: clientId } },
    });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.planItemOutcome.deleteMany({
      where: { planItem: { planVersion: { plan: { clientId } } } },
    });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.clientGoalRevision.deleteMany({ where: { clientId } });
    await prisma.clientGoal.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, consultantId] } } });
    await prisma.$disconnect();
  });
  test('requires a current source preview and preserves actual completion dates', async () => {
    expect(await reconcile('Same sources')).toMatchObject({ changed: false });
    const oldPreview = await getPlanSourcePreview(prisma, clientId, planId);
    const goal = await prisma.clientGoal.create({
      data: {
        clientId,
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: 50000,
        priority: 'PRIMARY',
      },
    });
    goalId = goal.id;
    const revision = await prisma.clientGoalRevision.create({
      data: {
        goalId,
        clientId,
        version: 1,
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: 50000,
        allowAnnualFee: false,
        priority: goal.priority,
        status: 'ACTIVE',
      },
    });
    await expect(
      reconcilePlanSources(prisma, {
        clientId,
        planId,
        actorId: consultantId,
        expectedVersion: oldPreview.expectedVersion,
        expectedSourceFingerprint: oldPreview.fingerprint,
        reason: 'Old comparison',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_SOURCES_CHANGED' });
    const originalCompleted = await prisma.planItem.findUniqueOrThrow({
      where: { id: completedItemId },
    });
    expect(await reconcile('Primary goal is now recorded')).toMatchObject({
      changed: true,
      version: 2,
    });
    const next = await builder();
    expect(next.sourceGoalRevisionId).toBe(revision.id);
    expect(next.items[0]).toMatchObject({
      status: 'COMPLETED',
      completedAt: originalCompleted.completedAt,
      acknowledgedAt: originalCompleted.acknowledgedAt,
    });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: completedItemId } })).toBe(1);
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: completedItemId,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_NOT_ACTIVE' });
  });
  test('edits a replacement in place, protects progress, and publishes version-specific metadata', async () => {
    const before = await builder();
    const draft = {
      ...(await payload()),
      title: 'Updated preparation',
      purpose: 'PREPARATION' as const,
    };
    await revisePlanDraft(prisma, planId, before.optimisticVersion, draft);
    const saved = await builder();
    expect(saved.id).toBe(before.id);
    expect(saved.version).toBe(before.version);
    expect(saved.items.map((item) => item.id)).toEqual(before.items.map((item) => item.id));
    expect(saved.items[0]?.status).toBe('COMPLETED');
    expect((await getClientPlan(prisma, clientId)).plan?.title).toBe('Nurture preparation');
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: planId } })).toMatchObject({
      title: 'Nurture preparation',
      purpose: 'NURTURE',
    });
    await expect(
      revisePlanDraft(prisma, planId, saved.optimisticVersion, {
        ...draft,
        items: draft.items.map((item, i) =>
          i === 0 ? { ...item, clientTitle: 'Replace completed instructions' } : item,
        ),
      }),
    ).rejects.toMatchObject({ code: 'PLAN_PROGRESS_PROTECTED' });
    await expect(
      approvePlan(prisma, clientId, planId, consultantId, before.optimisticVersion),
    ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await approvePlan(prisma, clientId, planId, consultantId, saved.optimisticVersion);
    expect(
      await prisma.workItem.findFirstOrThrow({
        where: {
          clientId,
          sourceId: saved.id,
          reasonCode: 'PLAN_RECONCILIATION_REQUIRED',
        },
      }),
    ).toMatchObject({ status: 'COMPLETED', resolvedAt: expect.any(Date) });
    expect((await getClientPlan(prisma, clientId)).plan).toMatchObject({
      title: 'Updated preparation',
      purpose: 'PREPARATION',
    });
    expect(await prisma.plan.findUniqueOrThrow({ where: { id: planId } })).toMatchObject({
      title: 'Updated preparation',
      purpose: 'PREPARATION',
    });
    const active = await builder();
    expect(active.items[0]?.status).toBe('COMPLETED');
    expect(active.items[1]?.status).toBe('AVAILABLE');
  });
  test('two editors cannot overwrite each other, including when creating the first revision', async () => {
    const current = await builder();
    const draft = await payload();
    const results = await Promise.allSettled([
      revisePlanDraft(prisma, planId, current.optimisticVersion, { ...draft, title: 'Editor one' }),
      revisePlanDraft(prisma, planId, current.optimisticVersion, { ...draft, title: 'Editor two' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'VERSION_CONFLICT' },
    });
  });
  test('approval rejects changed source facts and reconciliation retains the existing private draft', async () => {
    const previous = await builder();
    const goal = await prisma.clientGoal.findUniqueOrThrow({ where: { id: goalId } });
    await prisma.clientGoalRevision.create({
      data: {
        goalId,
        clientId,
        version: 2,
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: 75000,
        allowAnnualFee: false,
        priority: goal.priority,
        status: 'ACTIVE',
      },
    });
    await expect(
      approvePlan(prisma, clientId, planId, consultantId, previous.optimisticVersion),
    ).rejects.toMatchObject({ code: 'PLAN_SOURCES_CHANGED' });
    await reconcile('Desired amount increased');
    const updated = await builder();
    expect(updated.id).toBe(previous.id);
    expect(updated.title).toBe(previous.title);
    expect(updated.items.map((item) => item.id)).toEqual(previous.items.map((item) => item.id));
  });
  test('rejects unowned source references before saving a draft', async () => {
    await expect(
      createPlanDraft(prisma, clientId, { ...original, sourceGoalRevisionId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'PLAN_SOURCE_INVALID' });
    await expect(
      createPlanDraft(prisma, clientId, { ...original, sourceReviewId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'PLAN_SOURCE_INVALID' });
  });
});
