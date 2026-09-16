import { getCase, clearRestrictions } from '../majorReadiness/service.js';
import { getCreditWorkspace } from '../workspace/service.js';
import { getPublishedCreditCenter } from '../reviews/publishedCreditCenter.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import {
  approvePlan,
  cancelPrivatePlan,
  getPlanVersionHistory,
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
      where: {
        clientId,
        action: { in: ['plan.approved', 'plan.draft.created', 'plan.draft.cancelled'] },
      },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { subjectId: clientId, operation: { in: ['create', 'cancel-private-plan'] } },
    });
    await prisma.workItem.deleteMany({ where: { clientId, domain: 'PLAN' } });
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
    const first = await listClientPlans(prisma, clientId, undefined, {
      search: 'Library',
      status: 'DRAFT',
    });
    expect(first.plans).toHaveLength(20);
    expect(first.nextBefore).toBeTruthy();
    const second = await listClientPlans(prisma, clientId, first.nextBefore!, {
      search: 'Library',
      status: 'DRAFT',
    });
    expect(second.plans).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
    expect([...first.plans, ...second.plans].map((plan) => plan.id).sort()).toEqual(ids.sort());
    await prisma.plan.deleteMany({ where: { clientId } });
  });

  test('searches saved version titles within the client and combines lifecycle filters', async () => {
    const first = await createPlanDraft(prisma, clientId, { ...draft, title: 'Earlier name' });
    const builder = await getPlanBuilder(prisma, clientId, first.planId);
    await revisePlanDraft(prisma, first.planId, builder.plan!.versions[0]!.optimisticVersion, {
      ...draft,
      title: 'Updated research title',
    });
    const closed = await createPlanDraft(prisma, clientId, {
      ...draft,
      title: 'Updated closed title',
    });
    await prisma.plan.update({ where: { id: closed.planId }, data: { status: 'CANCELLED' } });
    const matching = await listClientPlans(prisma, clientId, undefined, {
      search: '  UPDATED  ',
      status: 'DRAFT',
    });
    expect(matching.plans.map((plan) => plan.id)).toEqual([first.planId]);
    expect(matching.plans[0]!.versions[0]!.title).toBe('Updated research title');
    expect(
      (await listClientPlans(prisma, clientId, undefined, { search: 'Earlier name' })).plans.map(
        (plan) => plan.id,
      ),
    ).toEqual([first.planId]);
    expect(
      (
        await listClientPlans(prisma, clientId, undefined, {
          search: 'Updated',
          status: 'CANCELLED',
        })
      ).plans.map((plan) => plan.id),
    ).toEqual([closed.planId]);
    expect(
      (await listClientPlans(prisma, randomUUID(), undefined, { search: 'Updated' })).plans,
    ).toEqual([]);
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
    const workspace = await getCreditWorkspace(prisma, clientId, clientView);
    const center = await getPublishedCreditCenter(prisma, clientId);
    expect(workspace.plan).toEqual(clientView.summary);
    expect(center.workspace.plan).toEqual(clientView.summary);
    expect(center.workspace.currentFocus).toEqual(workspace.currentFocus);
    expect(workspace.plan).toMatchObject({ totalActionCount: 1, guidanceCount: 1 });
    expect(JSON.stringify(workspace)).not.toMatch(
      /Never expose this rationale|Updated draft guidance|Private future Plan/,
    );
    expect((await getCreditWorkspace(prisma, randomUUID())).plan.source).toBeNull();
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
  test('cancels private drafts once, retains history and closes only their reminders', async () => {
    const created = await createPlanDraft(prisma, clientId, draft);
    const current = (await getClientPlan(prisma, clientId)).plan?.id;
    const work = await prisma.workItem.create({
      data: {
        clientId,
        title: 'Draft review',
        domain: 'PLAN',
        authority: 'ATTENTION_PROJECTION',
        sourceType: 'PlanVersion',
        sourceId: created.versionId,
        reasonCode: 'PLAN_RECONCILIATION_REQUIRED',
      },
    });
    const command = {
      clientId,
      planId: created.planId,
      actorId,
      expectedVersion: 1,
      reason: 'Duplicate preparation draft',
      key: randomUUID(),
    };
    await Promise.all([cancelPrivatePlan(prisma, command), cancelPrivatePlan(prisma, command)]);
    const history = await getPlanVersionHistory(prisma, clientId, created.planId);
    expect(history.cancellation?.reason).toBe(command.reason);
    expect(history.versions[0]?.status).toBe('CANCELLED');
    expect(history.versions[0]?.items).toHaveLength(draft.items.length);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: work.id } })).status).toBe(
      'CANCELLED',
    );
    expect((await getClientPlan(prisma, clientId)).plan?.id).toBe(current);
    expect(
      await prisma.auditEvent.count({
        where: { entityId: created.planId, action: 'plan.draft.cancelled' },
      }),
    ).toBe(1);
    await expect(approvePlan(prisma, clientId, created.planId, actorId)).rejects.toMatchObject({
      code: 'PLAN_IMMUTABLE',
    });
  });

  test('rejects foreign, changed and previously published Plans', async () => {
    const created = await createPlanDraft(prisma, clientId, draft);
    const command = {
      clientId,
      planId: created.planId,
      actorId,
      expectedVersion: 1,
      reason: 'No longer needed',
      key: randomUUID(),
    };
    await expect(
      cancelPrivatePlan(prisma, { ...command, clientId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await revisePlanDraft(prisma, created.planId, 1, { ...draft, title: 'Edited' });
    await expect(cancelPrivatePlan(prisma, command)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
    });
    await approvePlan(prisma, clientId, created.planId, actorId, 2);
    await expect(
      cancelPrivatePlan(prisma, { ...command, key: randomUUID(), expectedVersion: 3 }),
    ).rejects.toMatchObject({ code: 'PLAN_CANCELLATION_NOT_ALLOWED' });
  });

  test('serializes cancellation against a concurrent draft edit', async () => {
    const created = await createPlanDraft(prisma, clientId, draft);
    const results = await Promise.allSettled([
      cancelPrivatePlan(prisma, {
        clientId,
        planId: created.planId,
        actorId,
        expectedVersion: 1,
        reason: 'Race proof',
        key: randomUUID(),
      }),
      revisePlanDraft(prisma, created.planId, 1, { ...draft, title: 'Concurrent edit' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const saved = (await getPlanBuilder(prisma, clientId, created.planId)).plan!;
    expect(['CANCELLED', 'DRAFT']).toContain(saved.status);
    expect(saved.versions[0]?.optimisticVersion).toBe(2);
  });
  test('serializes different-Plan approvals against the publication both reviewers saw', async () => {
    const current = (await getPlanBuilder(prisma, clientId)).clientPublication;
    const expectedPublication = current
      ? { planId: current.planId, version: current.version }
      : null;
    const left = await createPlanDraft(prisma, clientId, { ...draft, title: 'Candidate left' });
    const right = await createPlanDraft(prisma, clientId, { ...draft, title: 'Candidate right' });
    // Earlier fixtures deliberately use future approval dates. Normalize only this isolated test client's metadata.
    await prisma.planVersion.updateMany({
      where: { plan: { clientId }, approvedAt: { not: null } },
      data: { approvedAt: new Date('2020-01-01') },
    });
    const refreshed = (await getPlanBuilder(prisma, clientId)).clientPublication;
    const baseline = refreshed
      ? { planId: refreshed.planId, version: refreshed.version }
      : expectedPublication;
    const results = await Promise.allSettled([
      approvePlan(prisma, clientId, left.planId, actorId, 1, baseline),
      approvePlan(prisma, clientId, right.planId, actorId, 1, baseline),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'PLAN_PUBLICATION_CHANGED' },
    });
    const versions = await prisma.planVersion.findMany({
      where: { planId: { in: [left.planId, right.planId] } },
    });
    expect(versions.filter((version) => version.status === 'DRAFT')).toHaveLength(1);
    expect(versions.filter((version) => version.status === 'ACTIVE')).toHaveLength(1);
    await expect(
      approvePlan(
        prisma,
        clientId,
        versions.find((version) => version.status === 'DRAFT')!.planId,
        actorId,
        1,
        null,
      ),
    ).rejects.toMatchObject({ code: 'PLAN_PUBLICATION_CHANGED' });
  });

  test('workspace and Center compose the safe session read with client and lifecycle filters', async () => {
    const session = {
      id: randomUUID(),
      roundId: randomUUID(),
      status: 'LIVE',
      version: 3,
      updatedAt: new Date(),
    };
    const read = vi
      .spyOn(prisma.applicationSession, 'findFirst')
      .mockResolvedValue(session as never);
    try {
      const workspace = await getCreditWorkspace(prisma, clientId);
      const center = await getPublishedCreditCenter(prisma, clientId);
      expect(read).toHaveBeenCalledWith({
        where: {
          clientId,
          endedAt: null,
          status: { in: ['LIVE', 'PAUSED', 'WAITING_FOR_CLIENT', 'WAITING_FOR_CONSULTANT'] },
        },
        select: { id: true, roundId: true, status: true, version: true, updatedAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
      expect(center.workspace.currentFocus).toEqual(workspace.currentFocus);
      expect(workspace.currentFocus.action).toBe('/app/rounds/' + session.roundId + '/live');
      expect(workspace.sources.liveSession).toEqual(session);
      read.mockResolvedValueOnce(null);
      expect((await getCreditWorkspace(prisma, randomUUID())).sources.liveSession).toBeNull();
    } finally {
      read.mockRestore();
    }
  });
  test('persisted coordination restrictions are scoped, shared and cleared without resuming work', async () => {
    const major = await prisma.majorReadinessCase.create({
      data: { clientId, intentType: 'MORTGAGE', status: 'COORDINATION', createdByUserId: actorId },
    });
    try {
      const recommendation = await prisma.majorReadinessRecommendation.create({
        data: {
          caseId: major.id,
          version: 1,
          type: 'PREPARE_FIRST',
          clientSafeExplanation: 'Coordinate timing',
          internalRationale: 'private-major-rationale',
          sourceFingerprint: 'private-major-source',
          sourceSnapshot: {},
          approvedByUserId: actorId,
          approvedAt: new Date(),
        },
      });
      const decision = await prisma.coordinationDecision.create({
        data: {
          caseId: major.id,
          version: 1,
          type: 'PAUSE_CARD_ACTIVITY',
          clientSafeExplanation: 'Wait for guidance',
          internalRationale: 'private-decision-rationale',
          sourceRecommendationId: recommendation.id,
          decidedByUserId: actorId,
        },
      });
      await prisma.clientCreditActivityRestriction.create({
        data: {
          clientId,
          caseId: major.id,
          decisionId: decision.id,
          scope: 'SCHEDULING',
          reasonCode: 'PAUSE_CARD_ACTIVITY',
        },
      });
      const workspace = await getCreditWorkspace(prisma, clientId);
      expect(workspace.currentFocus).toMatchObject({
        code: 'MAJOR_COORDINATION',
        action: '/app/major-readiness/coordination?caseId=' + major.id,
      });
      expect((await getPublishedCreditCenter(prisma, clientId)).workspace.currentFocus).toEqual(
        workspace.currentFocus,
      );
      expect(JSON.stringify(workspace)).not.toMatch(/private-major|private-decision/);
      expect((await getCreditWorkspace(prisma, randomUUID())).coordinationRestrictions).toEqual([]);
      await expect(getCase(prisma, randomUUID(), major.id)).rejects.toMatchObject({
        code: 'MAJOR_READINESS_CASE_NOT_FOUND',
      });
      const cleared = await clearRestrictions(prisma, {
        caseId: major.id,
        clientId,
        actorId,
        reason: 'Test reassessment',
        idempotencyKey: randomUUID(),
      });
      expect(cleared).toMatchObject({
        result: { cleared: 1, revalidationRequired: true },
        replayed: false,
      });
      const after = await getCreditWorkspace(prisma, clientId);
      expect(after.coordinationRestrictions).toEqual([]);
      expect(after.currentFocus.code).not.toBe('MAJOR_COORDINATION');
    } finally {
      await prisma.majorReadinessEvent.deleteMany({ where: { caseId: major.id } });
      await prisma.clientCreditActivityRestriction.deleteMany({ where: { caseId: major.id } });
      await prisma.coordinationDecision.deleteMany({ where: { caseId: major.id } });
      await prisma.majorReadinessRecommendation.deleteMany({ where: { caseId: major.id } });
      await prisma.majorReadinessCase.delete({ where: { id: major.id } });
    }
  });
  test('workspace passes the server clock and client-scoped appointment into shared focus', async () => {
    const now = new Date('2026-09-16T14:30:00Z');
    const appointment = {
      id: randomUUID(),
      roundId: randomUUID(),
      status: 'BOOKED',
      startsAt: new Date('2026-09-16T15:00:00Z'),
      endsAt: new Date('2026-09-16T16:00:00Z'),
      timezone: 'America/New_York',
    };
    const read = vi.spyOn(prisma.appointment, 'findFirst').mockResolvedValue(appointment as never);
    try {
      const workspace = await getCreditWorkspace(prisma, clientId, undefined, now);
      expect(read).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clientId, status: 'BOOKED', endsAt: { gt: now } },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(workspace.currentFocus.code).toBe('APPOINTMENT_UPCOMING');
      expect(workspace.refreshAt).toEqual(appointment.endsAt);
      expect(workspace.currentFocus.action).toBe(
        '/app/rounds/' + appointment.roundId + '/schedule',
      );
      expect(
        (await getCreditWorkspace(prisma, clientId, undefined, new Date('2026-09-16T16:00:00Z')))
          .currentFocus.code,
      ).not.toBe('APPOINTMENT_UPCOMING');
    } finally {
      read.mockRestore();
    }
  });
});
