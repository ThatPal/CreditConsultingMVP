import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import {
  approvePlan,
  clientSafeVersion,
  createPlanDraft,
  getClientPlan,
  getPlanBuilder,
  listClientPlans,
  revisePlanDraft,
  type PlanDraftInput,
} from './service.js';

describe('Plan authoring and approval', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
  const marker = `plan-${randomUUID()}`;
  let clientId = '';
  let actorId = '';
  const draft: PlanDraftInput = {
    title: 'Preparation plan',
    purpose: 'PREPARATION',
    items: [
      {
        stableKey: 'guide',
        type: 'GUIDANCE',
        completionMode: 'ACKNOWLEDGEMENT',
        owner: 'CLIENT',
        clientTitle: 'Read this first',
        clientBody: 'Safe guidance',
        consultantRationale: 'Never expose this rationale',
        sortOrder: 0,
        pathKeys: [],
      },
      {
        stableKey: 'action',
        type: 'ACTION',
        completionMode: 'STRUCTURED_OUTCOME',
        owner: 'CLIENT',
        clientTitle: 'Report progress',
        outcomeSchema: {
          type: 'object',
          properties: { progress: { type: 'string' } },
          required: ['progress'],
        },
        sortOrder: 1,
        pathKeys: [],
      },
    ],
    dependencies: [{ dependentKey: 'action', prerequisiteKey: 'guide' }],
  };
  beforeAll(async () => {
    await prisma.$connect();
    const actor = await prisma.user.create({
      data: { email: `${marker}@example.test`, role: 'CONSULTANT', status: 'ACTIVE' },
    });
    actorId = actor.id;
    clientId = (
      await prisma.client.create({
        data: {
          firstName: marker,
          lastName: 'Client',
          termsAcceptedAt: new Date(),
          assignedConsultantId: actor.id,
        },
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({
      where: { payload: { path: ['clientId'], equals: clientId } },
    });
    await prisma.auditEvent.deleteMany({ where: { clientId, action: 'plan.approved' } });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('lists only this client, selects older Plans without publishing, and rejects foreign cursors', async () => {
    const first = await createPlanDraft(prisma, clientId, { ...draft, title: 'Older draft' });
    await createPlanDraft(prisma, clientId, { ...draft, title: 'Newer draft' });
    const selected = await getPlanBuilder(prisma, clientId, first.planId);
    expect(selected.plan?.id).toBe(first.planId);
    expect(selected.clientPublication).toBeNull();
    const library = await listClientPlans(prisma, clientId);
    expect(library.plans.map((plan) => plan.id)).toContain(first.planId);
    expect(library.nextBefore).toBeNull();
    const after = await listClientPlans(prisma, clientId, library.plans[0]!.id);
    expect(after.plans.map((plan) => plan.id)).toEqual(
      library.plans.slice(1).map((plan) => plan.id),
    );
    await expect(getPlanBuilder(prisma, randomUUID(), first.planId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(listClientPlans(prisma, randomUUID(), first.planId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(getPlanBuilder(prisma, clientId, randomUUID())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await prisma.plan.deleteMany({ where: { clientId } });
  });

  test('Plan library traverses a full page without repeating or losing Plans', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 21; index++)
      ids.push(
        (await createPlanDraft(prisma, clientId, { ...draft, title: `Library ${index}` })).planId,
      );
    const first = await listClientPlans(prisma, clientId);
    expect(first.plans).toHaveLength(20);
    expect(first.nextBefore).toBeTruthy();
    const second = await listClientPlans(prisma, clientId, first.nextBefore!);
    expect(second.plans).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
    expect([...first.plans, ...second.plans].map((plan) => plan.id).sort()).toEqual(ids.sort());
    await prisma.plan.deleteMany({ where: { clientId } });
  });

  test('creates, freezes, positively projects, and safely versions a Plan', async () => {
    const created = await createPlanDraft(prisma, clientId, draft);
    const builder = await getPlanBuilder(prisma, clientId);
    expect(builder.plan?.versions[0]?.items.map(({ stableKey }) => stableKey)).toEqual([
      'guide',
      'action',
    ]);
    await expect(revisePlanDraft(prisma, created.planId, 999, draft)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    await approvePlan(prisma, clientId, created.planId, actorId);
    const approved = await getPlanBuilder(prisma, clientId);
    const frozen = approved.plan!.versions[0]!;
    const projection = clientSafeVersion(frozen);
    expect(JSON.stringify(projection)).not.toContain('Never expose this rationale');
    expect(projection.items[0]).not.toHaveProperty('consultantRationale');
    await revisePlanDraft(prisma, created.planId, frozen.optimisticVersion, {
      ...draft,
      title: 'Version two',
      items: draft.items.map((item) =>
        item.stableKey === 'guide' ? { ...item, clientTitle: 'Updated draft guidance' } : item,
      ),
    });
    const afterRevision = await getPlanBuilder(prisma, clientId);
    expect(afterRevision.plan!.versions).toHaveLength(2);
    expect(afterRevision.plan!.versions[1]!.items[0]!.clientTitle).toBe('Read this first');
    expect(await prisma.auditEvent.count({ where: { clientId, action: 'plan.approved' } })).toBe(1);
    expect(
      await prisma.outboxEvent.count({ where: { eventKey: `plan-approved:${frozen.id}` } }),
    ).toBe(1);
    // A separate newer draft cannot replace or hide the already published Plan.
    await createPlanDraft(prisma, clientId, { ...draft, title: 'Private future Plan' });
    const clientView = await getClientPlan(prisma, clientId);
    expect(clientView.plan?.id).toBe(created.planId);
    expect(clientView.plan?.version.items[0]?.title).toBe('Read this first');
    expect(JSON.stringify(clientView)).not.toContain('Updated draft guidance');
    expect(JSON.stringify(clientView)).not.toContain('Never expose this rationale');
  });
});
