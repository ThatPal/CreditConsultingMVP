import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { approvePlan, createPlanDraft, executePlanItem, getPlanBuilder, reconcilePlanSources, type PlanDraftInput } from './service.js';

describe('Nurture and source-version Plan reconciliation', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
  const marker = `reconcile-${randomUUID()}`;
  let clientId = '';
  let clientUserId = '';
  let consultantId = '';
  let planId = '';
  let completedItemId = '';
  beforeAll(async () => {
    await prisma.$connect();
    clientUserId = (await prisma.user.create({ data: { email: `${marker}-client@example.test`, role: 'CLIENT', status: 'ACTIVE' } })).id;
    consultantId = (await prisma.user.create({ data: { email: `${marker}-consultant@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } })).id;
    clientId = (await prisma.client.create({ data: { userId: clientUserId, firstName: marker, lastName: 'Client', termsAcceptedAt: new Date(), assignedConsultantId: consultantId } })).id;
    const draft: PlanDraftInput = {
      title: 'Nurture preparation', purpose: 'NURTURE', sourceProfileVersion: 1,
      items: [
        { stableKey: 'completed-guidance', type: 'GUIDANCE', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Protected approved guidance', consultantRationale: 'Manual rationale', manuallyProtected: true, sortOrder: 0 },
        { stableKey: 'future-action', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Future action', sortOrder: 1 },
      ],
      dependencies: [{ dependentKey: 'future-action', prerequisiteKey: 'completed-guidance' }],
    };
    const created = await createPlanDraft(prisma, clientId, draft);
    planId = created.planId;
    await approvePlan(prisma, clientId, planId, consultantId);
    completedItemId = (await getPlanBuilder(prisma, clientId)).plan!.versions[0]!.items.find(({ stableKey }) => stableKey === 'completed-guidance')!.id;
    await executePlanItem(prisma, { clientId, itemId: completedItemId, actorId: clientUserId, idempotencyKey: randomUUID(), action: 'COMPLETE' });
  });
  afterAll(async () => {
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({ where: { payload: { path: ['clientId'], equals: clientId } } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.planItemOutcome.deleteMany({ where: { planItem: { planVersion: { plan: { clientId } } } } });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { id: { in: [clientUserId, consultantId] } } });
    await prisma.$disconnect();
  });

  test('ignores non-material change and creates an explicit preserving replacement for material change', async () => {
    await expect(reconcilePlanSources(prisma, { clientId, planId, actorId: consultantId, sourceProfileVersion: 1, material: false, reason: 'Display label only' })).resolves.toMatchObject({ changed: false });
    expect(await prisma.planVersion.count({ where: { planId } })).toBe(1);
    const changed = await reconcilePlanSources(prisma, { clientId, planId, actorId: consultantId, sourceProfileVersion: 2, material: true, reason: 'Published profile materially changed' });
    expect(changed).toMatchObject({ changed: true, version: 2 });
    const versions = await prisma.planVersion.findMany({ where: { planId }, include: { items: true }, orderBy: { version: 'asc' } });
    expect(versions[0]).toMatchObject({ status: 'STALE', staleReason: 'Published profile materially changed' });
    expect(versions[1]).toMatchObject({ status: 'DRAFT', supersedesVersionId: versions[0]!.id });
    expect(versions[1]!.items.find(({ stableKey }) => stableKey === 'completed-guidance')).toMatchObject({ clientTitle: 'Protected approved guidance', consultantRationale: 'Manual rationale', manuallyProtected: true, status: 'COMPLETED' });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: completedItemId } })).toBe(1);
    await expect(executePlanItem(prisma, { clientId, itemId: completedItemId, actorId: clientUserId, idempotencyKey: randomUUID(), action: 'COMPLETE' })).rejects.toMatchObject({ code: 'PLAN_NOT_ACTIVE' });
    expect(await prisma.workItem.count({ where: { sourceType: 'PlanVersion', sourceId: changed.versionId } })).toBe(1);
  });

  test('replacement becomes active only through governed approval and supersedes old history', async () => {
    await approvePlan(prisma, clientId, planId, consultantId);
    const versions = await prisma.planVersion.findMany({ where: { planId }, orderBy: { version: 'asc' } });
    expect(versions.map(({ status }) => status)).toEqual(['SUPERSEDED', 'ACTIVE']);
  });
});
