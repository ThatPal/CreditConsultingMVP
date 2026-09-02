import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { approvePlan, clientSafeVersion, createPlanDraft, getPlanBuilder, revisePlanDraft, type PlanDraftInput } from './service.js';

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
      { stableKey: 'guide', type: 'GUIDANCE', completionMode: 'ACKNOWLEDGEMENT', owner: 'CLIENT', clientTitle: 'Read this first', clientBody: 'Safe guidance', consultantRationale: 'Never expose this rationale', sortOrder: 0, pathKeys: [] },
      { stableKey: 'action', type: 'ACTION', completionMode: 'STRUCTURED_OUTCOME', owner: 'CLIENT', clientTitle: 'Report progress', sortOrder: 1, pathKeys: [] },
    ],
    dependencies: [{ dependentKey: 'action', prerequisiteKey: 'guide' }],
  };
  beforeAll(async () => {
    await prisma.$connect();
    const actor = await prisma.user.create({ data: { email: `${marker}@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } });
    actorId = actor.id;
    clientId = (await prisma.client.create({ data: { firstName: marker, lastName: 'Client', termsAcceptedAt: new Date(), assignedConsultantId: actor.id } })).id;
  });
  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { payload: { path: ['clientId'], equals: clientId } } });
    await prisma.auditEvent.deleteMany({ where: { clientId, action: 'plan.approved' } });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('creates, freezes, positively projects, and safely versions a Plan', async () => {
    const created = await createPlanDraft(prisma, clientId, draft);
    const builder = await getPlanBuilder(prisma, clientId);
    expect(builder.plan?.versions[0]?.items.map(({ stableKey }) => stableKey)).toEqual(['guide', 'action']);
    await expect(revisePlanDraft(prisma, created.planId, 999, draft)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    await approvePlan(prisma, clientId, created.planId, actorId);
    const approved = await getPlanBuilder(prisma, clientId);
    const frozen = approved.plan!.versions[0]!;
    const projection = clientSafeVersion(frozen);
    expect(JSON.stringify(projection)).not.toContain('Never expose this rationale');
    expect(projection.items[0]).not.toHaveProperty('consultantRationale');
    await revisePlanDraft(prisma, created.planId, frozen.optimisticVersion, { ...draft, title: 'Version two', items: draft.items.map((item) => item.stableKey === 'guide' ? { ...item, clientTitle: 'Updated draft guidance' } : item) });
    const afterRevision = await getPlanBuilder(prisma, clientId);
    expect(afterRevision.plan!.versions).toHaveLength(2);
    expect(afterRevision.plan!.versions[1]!.items[0]!.clientTitle).toBe('Read this first');
    expect(await prisma.auditEvent.count({ where: { clientId, action: 'plan.approved' } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { eventKey: `plan-approved:${frozen.id}` } })).toBe(1);
  });
});
