import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { getClientPlan, getPlanItemHistory } from './service.js';
import { preparePlanAttachments } from './attachments.js';
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
    await prisma.document.deleteMany({ where: { clientId } });
    await prisma.documentType.deleteMany({ where: { key: marker } });
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

  test('pins private document versions and question labels, rejects unavailable evidence, and supports correction', async () => {
    const documentType = await prisma.documentType.create({
      data: {
        key: marker,
        name: 'QA evidence',
        allowedMimeTypes: ['application/pdf'],
        allowedExtensions: ['.pdf'],
        maximumSizeBytes: 1000,
        retentionCategory: 'TEST',
      },
    });
    const file = await prisma.document.create({
      data: {
        clientId,
        documentTypeId: documentType.id,
        originalFileName: 'evidence.pdf',
        displayFileName: 'Original evidence.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        sha256: 'original-hash',
        storageProvider: 'LOCAL_DISK',
        storageKey: marker,
        uploadedByUserId: clientUserId,
        retentionCategory: 'TEST',
        clientVisible: true,
      },
    });
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Attachment review',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'evidence',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Submit evidence',
          sortOrder: 0,
          outcomeSchema: {
            type: 'object',
            properties: { report: { type: 'string', title: 'Original question' } },
            required: ['report'],
          },
        },
      ],
      dependencies: [],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const step = (await getClientPlan(prisma, clientId)).plan!.version.items[0]!;
    const submit = (ids: string[]) =>
      executePlanItem(prisma, {
        clientId,
        itemId: step.id,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
        outcome: { report: 'Evidence attached' },
        documentIds: ids,
      });
    await expect(submit([file.id, file.id])).rejects.toMatchObject({
      code: 'PLAN_ATTACHMENTS_INVALID',
    });
    await expect(submit(Array.from({ length: 6 }, () => randomUUID()))).rejects.toMatchObject({
      code: 'PLAN_ATTACHMENTS_INVALID',
    });
    await expect(submit([randomUUID()])).rejects.toMatchObject({
      code: 'PLAN_ATTACHMENT_UNAVAILABLE',
    });
    for (const status of ['SUPERSEDED', 'DELETED'] as const) {
      await prisma.document.update({ where: { id: file.id }, data: { status } });
      await expect(submit([file.id])).rejects.toMatchObject({
        code: 'PLAN_ATTACHMENT_UNAVAILABLE',
      });
    }
    await prisma.document.update({
      where: { id: file.id },
      data: { status: 'AVAILABLE', clientVisible: false },
    });
    await expect(submit([file.id])).rejects.toMatchObject({ code: 'PLAN_ATTACHMENT_UNAVAILABLE' });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: step.id } })).toBe(0);
    await prisma.document.update({ where: { id: file.id }, data: { clientVisible: true } });
    await expect(
      prisma.$transaction((tx) => preparePlanAttachments(tx, randomUUID(), [file.id])),
    ).rejects.toMatchObject({ code: 'PLAN_ATTACHMENT_UNAVAILABLE' });
    const first = await submit([file.id]);
    await prisma.document.update({
      where: { id: file.id },
      data: { displayFileName: 'Renamed.pdf', status: 'SUPERSEDED' },
    });
    const history = (await getClientPlan(prisma, clientId)).plan!.version.items[0]!.history;
    expect(history[0]!.attachments[0]).toMatchObject({
      fileName: 'Original evidence.pdf',
      sha256: 'original-hash',
      available: true,
      status: 'SUPERSEDED',
    });
    expect(history[0]!.responseSnapshot).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'report', label: 'Original question' }),
      ]),
    );
    await prisma.document.update({ where: { id: file.id }, data: { status: 'DELETED' } });
    await expect(
      verifyPlanItem(prisma, clientId, step.id, consultantId, {
        decision: 'VERIFY',
        expectedOutcomeId: first.outcomeId,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_EVIDENCE_UNAVAILABLE' });
    await verifyPlanItem(prisma, clientId, step.id, consultantId, {
      decision: 'RETURN',
      expectedOutcomeId: first.outcomeId,
      note: 'Please attach an available file.',
    });
    await prisma.document.update({ where: { id: file.id }, data: { status: 'AVAILABLE' } });
    const second = await submit([file.id]);
    await verifyPlanItem(prisma, clientId, step.id, consultantId, {
      decision: 'VERIFY',
      expectedOutcomeId: second.outcomeId,
    });
    expect(await prisma.planOutcomeAttachment.count({ where: { documentId: file.id } })).toBe(2);
    expect(
      await prisma.planOutcomeAttachment.findFirst({ where: { outcomeId: first.outcomeId } }),
    ).toMatchObject({ fileName: 'Original evidence.pdf' });
  });

  test('answers help requests without completing work, retains repeated requests and rejects stale decisions', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Help lifecycle',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'help-cycle',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Read the preparation guide',
          sortOrder: 0,
        },
        {
          stableKey: 'after-help',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Continue preparation',
          sortOrder: 1,
        },
      ],
      dependencies: [{ dependentKey: 'after-help', prerequisiteKey: 'help-cycle' }],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const items = (await getClientPlan(prisma, clientId)).plan!.version.items;
    const guide = items.find((row) => row.stableKey === 'help-cycle')!;
    const next = items.find((row) => row.stableKey === 'after-help')!;
    const ask = () =>
      executePlanItem(prisma, {
        clientId,
        itemId: guide.id,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'UNABLE',
        reason: 'Where do I find the guide?',
      });
    const first = await ask();
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: guide.id } })).toMatchObject({
      status: 'UNABLE',
      acknowledgedAt: null,
    });
    await expect(
      verifyPlanItem(prisma, clientId, guide.id, consultantId, {
        decision: 'VERIFY',
        expectedOutcomeId: first.outcomeId,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAN_ITEM_STATE' });
    await expect(
      verifyPlanItem(prisma, clientId, guide.id, consultantId, {
        decision: 'RESUME',
        expectedOutcomeId: first.outcomeId,
        note: ' ',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_HELP_INVALID' });
    await expect(
      verifyPlanItem(prisma, randomUUID(), guide.id, consultantId, {
        decision: 'RESUME',
        expectedOutcomeId: first.outcomeId,
        note: 'Read the document.',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await verifyPlanItem(prisma, clientId, guide.id, consultantId, {
      decision: 'RESUME',
      expectedOutcomeId: first.outcomeId,
      note: 'Open Documents and read the preparation guide.',
    });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: guide.id } })).toMatchObject({
      status: 'IN_PROGRESS',
      completedAt: null,
      acknowledgedAt: null,
    });
    expect(await prisma.planItem.findUniqueOrThrow({ where: { id: next.id } })).toMatchObject({
      status: 'LOCKED',
    });
    expect(
      await prisma.workItem.count({
        where: { sourceId: guide.id, status: { in: ['OPEN', 'WAITING', 'IN_PROGRESS'] } },
      }),
    ).toBe(0);
    const second = await ask();
    await expect(
      verifyPlanItem(prisma, clientId, guide.id, consultantId, {
        decision: 'RESUME',
        expectedOutcomeId: first.outcomeId,
        note: 'Old reply',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_EVIDENCE_CHANGED' });
    expect(
      await prisma.workItem.count({
        where: { sourceId: guide.id, status: { in: ['OPEN', 'WAITING', 'IN_PROGRESS'] } },
      }),
    ).toBe(1);
    await verifyPlanItem(prisma, clientId, guide.id, consultantId, {
      decision: 'RESUME',
      expectedOutcomeId: second.outcomeId,
      note: 'The preparation guide is the first file in Documents.',
    });
    await executePlanItem(prisma, {
      clientId,
      itemId: guide.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE',
    });
    const final = (await getClientPlan(prisma, clientId)).plan!.version.items;
    expect(final.find((row) => row.id === guide.id)!.history.map((row) => row.kind)).toEqual([
      'UNABLE',
      'HELP_RESOLVED',
      'UNABLE',
      'HELP_RESOLVED',
      'COMPLETE',
    ]);
    expect(final.find((row) => row.id === next.id)!.status).toBe('AVAILABLE');
  });

  test('paginates stable history without duplicates at equal timestamps and rejects foreign cursors', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'History pagination',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'history',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'History fixture',
          sortOrder: 0,
        },
        {
          stableKey: 'other-history',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Other step',
          sortOrder: 1,
        },
      ],
      dependencies: [],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const items = (await getClientPlan(prisma, clientId)).plan!.version.items;
    const step = items.find((row) => row.stableKey === 'history')!;
    const other = items.find((row) => row.stableKey === 'other-history')!;
    const records = Array.from({ length: 45 }, () => ({
      id: randomUUID(),
      planItemId: step.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      kind: 'UNABLE',
      data: { reason: 'Synthetic history event' },
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    }));
    await prisma.planItemOutcome.createMany({ data: records });
    const first = await getPlanItemHistory(prisma, clientId, step.id);
    expect(first.history).toHaveLength(20);
    expect(first.historyLimited).toBe(true);
    await prisma.planItemOutcome.create({
      data: {
        planItemId: step.id,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        kind: 'HELP_RESOLVED',
        data: { note: 'New event during pagination' },
      },
    });
    const second = await getPlanItemHistory(prisma, clientId, step.id, first.history[0]!.id);
    const third = await getPlanItemHistory(prisma, clientId, step.id, second.history[0]!.id);
    expect(third.history).toHaveLength(5);
    expect(third.historyLimited).toBe(false);
    const ids = [...third.history, ...second.history, ...first.history].map((row) => row.id);
    expect(new Set(ids).size).toBe(45);
    expect(ids).toEqual(records.map((row) => row.id).sort());
    await expect(getPlanItemHistory(prisma, randomUUID(), step.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      getPlanItemHistory(prisma, clientId, other.id, first.history[0]!.id),
    ).rejects.toMatchObject({ code: 'PLAN_HISTORY_CURSOR_INVALID' });
    const draft = await createPlanDraft(prisma, clientId, {
      title: 'Private draft',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'history',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Private instructions',
          sortOrder: 0,
        },
      ],
      dependencies: [],
    });
    const draftItem = await prisma.planItem.findFirstOrThrow({
      where: { planVersion: { planId: draft.planId } },
    });
    await expect(getPlanItemHistory(prisma, clientId, draftItem.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await getPlanItemHistory(prisma, clientId, step.id)).history).toHaveLength(20);
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
