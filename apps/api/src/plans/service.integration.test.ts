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
    await prisma.auditEvent.deleteMany({
      where: { clientId, action: { in: ['plan.approved', 'plan.draft.created'] } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { subjectId: clientId, operation: 'create' },
    });
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
  test('private revisions and source updates cannot promote an older publication', async () => {
    const older = await createPlanDraft(prisma, clientId, {
      ...draft,
      title: 'Old published plan',
    });
    await approvePlan(prisma, clientId, older.planId, actorId);
    const newer = await createPlanDraft(prisma, clientId, {
      ...draft,
      title: 'Current published plan',
    });
    await approvePlan(prisma, clientId, newer.planId, actorId);
    // Explicit timestamps avoid relying on test timing or random UUID tie breakers.
    await prisma.planVersion.update({
      where: { id: older.versionId },
      data: { approvedAt: new Date('2030-01-01') },
    });
    await prisma.planVersion.update({
      where: { id: newer.versionId },
      data: { approvedAt: new Date('2030-02-01') },
    });
    const baseline = (await getPlanBuilder(prisma, clientId, older.planId)).plan!.versions[0]!;
    await revisePlanDraft(prisma, older.planId, baseline.optimisticVersion, {
      ...draft,
      title: 'Private revision of older plan',
    });
    await prisma.plan.update({
      where: { id: older.planId },
      data: { updatedAt: new Date('2031-01-01') },
    });
    expect((await getClientPlan(prisma, clientId)).plan?.id).toBe(newer.planId);
    expect((await getPlanBuilder(prisma, clientId, older.planId)).clientPublication?.planId).toBe(
      newer.planId,
    );
    await prisma.planVersion.update({
      where: { id: newer.versionId },
      data: { status: 'STALE', staleAt: new Date() },
    });
    expect((await getClientPlan(prisma, clientId)).plan).toMatchObject({
      id: newer.planId,
      status: 'STALE',
    });
    expect((await getClientPlan(prisma, clientId, older.planId)).plan?.id).toBe(older.planId);
    await expect(getClientPlan(prisma, randomUUID(), older.planId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const revision = (await getPlanBuilder(prisma, clientId, older.planId)).plan!.versions[0]!;
    await approvePlan(prisma, clientId, older.planId, actorId, revision.optimisticVersion);
    await prisma.planVersion.update({
      where: { id: revision.id },
      data: { approvedAt: new Date('2030-03-01') },
    });
    expect((await getClientPlan(prisma, clientId)).plan?.id).toBe(older.planId);
  });

  test('closed Plans reject draft edits and publication even with a leftover draft version', async () => {
    for (const status of ['CANCELLED', 'SUPERSEDED'] as const) {
      const closed = await createPlanDraft(prisma, clientId, draft);
      await prisma.plan.update({ where: { id: closed.planId }, data: { status } });
      await expect(revisePlanDraft(prisma, closed.planId, 1, draft)).rejects.toMatchObject({
        code: 'PLAN_IMMUTABLE',
      });
      await expect(approvePlan(prisma, clientId, closed.planId, actorId, 1)).rejects.toMatchObject({
        code: 'PLAN_IMMUTABLE',
      });
      expect((await getPlanBuilder(prisma, clientId, closed.planId)).plan?.status).toBe(status);
    }
  });
  test('new draft context stays blank without creating records or hiding the current publication', async () => {
    const count = await prisma.plan.count({ where: { clientId } });
    const publication = (await getPlanBuilder(prisma, clientId)).clientPublication;
    const context = await getPlanBuilder(prisma, clientId, undefined, true);
    expect(context.plan).toBeNull();
    expect(context.clientPublication).toEqual(publication);
    expect(context.context.sources).toBeDefined();
    expect(await prisma.plan.count({ where: { clientId } })).toBe(count);
  });
  test('concurrent creation retries return one Plan and reject changed request content', async () => {
    const key = randomUUID();
    const before = await prisma.plan.count({ where: { clientId } });
    const results = await Promise.all(
      Array.from({ length: 3 }, () => createPlanDraft(prisma, clientId, draft, { key, actorId })),
    );
    expect(new Set(results.map((result) => result.planId)).size).toBe(1);
    expect(await prisma.plan.count({ where: { clientId } })).toBe(before + 1);
    expect(
      await prisma.auditEvent.count({
        where: { entityId: results[0]!.planId, action: 'plan.draft.created' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: results[0]!.planId, eventType: 'plan.draft.created' },
      }),
    ).toBe(1);
    await expect(
      createPlanDraft(prisma, clientId, { ...draft, title: 'Different content' }, { key, actorId }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(await createPlanDraft(prisma, clientId, draft, { key, actorId })).toEqual(results[0]);
  });
  test('definitive creation rejection leaves no Plan and permits a corrected request', async () => {
    const before = await prisma.plan.count({ where: { clientId } });
    await expect(
      createPlanDraft(
        prisma,
        clientId,
        { ...draft, sourceReviewId: randomUUID() },
        { key: randomUUID(), actorId },
      ),
    ).rejects.toMatchObject({ code: 'PLAN_CREATE_REJECTED' });
    expect(await prisma.plan.count({ where: { clientId } })).toBe(before);
    await createPlanDraft(prisma, clientId, draft, { key: randomUUID(), actorId });
    expect(await prisma.plan.count({ where: { clientId } })).toBe(before + 1);
  });
});
