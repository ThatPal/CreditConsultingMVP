import { listResponseDrafts } from './draftLibrary.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import {
  getClientPlan,
  getPlanItemHistory,
  getResponseDraft,
  saveResponseDraft,
  discardResponseDraft,
} from './service.js';
import { preparePlanAttachments } from './attachments.js';
import {
  approvePlan,
  createPlanDraft,
  revisePlanDraft,
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

  test('saves private drafts, rejects stale revisions/context and clears the draft on submission', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Draft recovery',
      purpose: 'NURTURE',
      items: [
        {
          stableKey: 'draft-step',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Prepare your response',
          sortOrder: 0,
        },
      ],
      dependencies: [],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const draftStepId = (await getClientPlan(prisma, clientId)).plan!.version.items[0]!.id;
    const context = await getResponseDraft(prisma, clientId, draftStepId, clientUserId);
    const input = {
      contextVersion: context.contextVersion,
      expectedRevision: 0,
      values: { unfinished: 'Partial answer' },
      note: 'Work in progress',
      help: false,
      documentIds: [],
    };
    const first = await saveResponseDraft(prisma, clientId, draftStepId, clientUserId, input);
    expect(first.draft).toMatchObject({ revision: 1, note: 'Work in progress' });
    expect(
      (await getResponseDraft(prisma, clientId, draftStepId, clientUserId)).draft?.values,
    ).toEqual({
      unfinished: 'Partial answer',
    });
    expect((await getResponseDraft(prisma, clientId, draftStepId, consultantId)).draft).toBeNull();
    await expect(
      getResponseDraft(prisma, randomUUID(), draftStepId, clientUserId),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      saveResponseDraft(prisma, clientId, draftStepId, clientUserId, input),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    await expect(
      saveResponseDraft(prisma, clientId, draftStepId, clientUserId, {
        ...input,
        expectedRevision: 1,
        contextVersion: '2000-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONTEXT_CHANGED' });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: draftStepId } })).toBe(0);
    expect(await prisma.workItem.count({ where: { sourceId: draftStepId } })).toBe(0);
    await saveResponseDraft(prisma, clientId, draftStepId, clientUserId, {
      ...input,
      expectedRevision: 1,
      note: 'Updated privately',
    });
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: draftStepId,
        actorId: clientUserId,
        idempotencyKey: randomUUID(),
        action: 'COMPLETE',
        draftRevision: 1,
        draftContextVersion: context.contextVersion,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    await executePlanItem(prisma, {
      clientId,
      itemId: draftStepId,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'UNABLE',
      reason: 'Need help after saving draft',
      draftRevision: 2,
      draftContextVersion: context.contextVersion,
    });
    expect(await prisma.planResponseDraft.count({ where: { itemId: draftStepId } })).toBe(0);
    const latest = (await getClientPlan(prisma, clientId)).plan;
    // A submitted draft remains cleared when the step is reopened.
    const outcome = await prisma.planItemOutcome.findFirstOrThrow({
      where: { planItemId: draftStepId },
      orderBy: { createdAt: 'desc' },
    });
    await verifyPlanItem(prisma, clientId, draftStepId, consultantId, {
      decision: 'RESUME',
      expectedOutcomeId: outcome.id,
      note: 'Please try again.',
    });
    expect(latest).not.toBeNull();
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
        where: {
          sourceType: 'PlanItem',
          sourceId: helpId,
          reasonCode: 'UNABLE',
          status: { not: 'COMPLETED' },
        },
      }),
    ).toBe(1);
  });
  test('a source-review marker blocks new client and consultant writes even while status is ACTIVE', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Paused source proof',
      purpose: 'PREPARATION',
      items: [
        {
          stableKey: 'ack',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Read guidance',
          sortOrder: 0,
        },
        {
          stableKey: 'report',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Report preparation',
          sortOrder: 1,
        },
      ],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const steps = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!.items;
    const ack = steps.find((item) => item.stableKey === 'ack')!;
    const report = steps.find((item) => item.stableKey === 'report')!;
    const ackRequest = {
      clientId,
      itemId: ack.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE' as const,
    };
    await executePlanItem(prisma, ackRequest);
    await executePlanItem(prisma, {
      clientId,
      itemId: report.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE',
      outcome: { clientReport: 'Prepared' },
    });
    await prisma.planVersion.update({
      where: { id: created.versionId },
      data: { staleAt: new Date(), staleReason: 'Updated source pending' },
    });
    const count = await prisma.planItemOutcome.count({
      where: { planItemId: { in: [ack.id, report.id] } },
    });
    await expect(
      executePlanItem(prisma, { ...ackRequest, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'PLAN_SOURCE_REVIEW_REQUIRED' });
    await expect(verifyPlanItem(prisma, clientId, report.id, consultantId)).rejects.toMatchObject({
      code: 'PLAN_SOURCE_REVIEW_REQUIRED',
    });
    expect(await executePlanItem(prisma, ackRequest)).toMatchObject({ replayed: true });
    expect(
      await prisma.planItemOutcome.count({ where: { planItemId: { in: [ack.id, report.id] } } }),
    ).toBe(count);
    expect((await prisma.planItem.findUniqueOrThrow({ where: { id: report.id } })).status).toBe(
      'AWAITING_VERIFICATION',
    );
  });
  test('hidden alternative steps reject direct responses without creating outcomes or attention', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Private alternative boundary',
      purpose: 'PREPARATION',
      paths: [
        { key: 'chosen', clientLabel: 'Current path', status: 'ACTIVE', sortOrder: 0 },
        { key: 'private', clientLabel: 'Private alternative', status: 'INACTIVE', sortOrder: 1 },
      ],
      items: [
        {
          stableKey: 'visible',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Current guidance',
          sortOrder: 0,
          pathKeys: ['chosen'],
        },
        {
          stableKey: 'hidden',
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: 'Private alternative guidance',
          sortOrder: 1,
          pathKeys: ['private'],
          required: false,
        },
      ],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const steps = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!.items;
    const hidden = steps.find((step) => step.stableKey === 'hidden')!;
    const visible = steps.find((step) => step.stableKey === 'visible')!;
    expect(hidden.status).toBe('AVAILABLE');
    expect(
      (await getClientPlan(prisma, clientId)).plan!.version.items.map((step) => step.id),
    ).not.toContain(hidden.id);
    for (const action of ['COMPLETE', 'UNABLE'] as const) {
      await expect(
        executePlanItem(prisma, {
          clientId,
          itemId: hidden.id,
          actorId: clientUserId,
          idempotencyKey: randomUUID(),
          action,
          reason: 'Need help',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    await expect(getResponseDraft(prisma, clientId, hidden.id, clientUserId)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    await expect(getPlanItemHistory(prisma, clientId, hidden.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: hidden.id } })).toBe(0);
    expect(
      await prisma.workItem.count({ where: { sourceType: 'PlanItem', sourceId: hidden.id } }),
    ).toBe(0);
    await executePlanItem(prisma, {
      clientId,
      itemId: visible.id,
      actorId: clientUserId,
      idempotencyKey: randomUUID(),
      action: 'COMPLETE',
    });
  });
  test('source-paused drafts remain readable but cannot overwrite the saved response', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Paused draft recovery',
      purpose: 'PREPARATION',
      items: [
        {
          stableKey: 'response',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Report preparation',
          sortOrder: 0,
        },
      ],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const item = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!
      .items[0]!;
    const context = await getResponseDraft(prisma, clientId, item.id, clientUserId);
    const input = {
      expectedRevision: 0,
      contextVersion: context.contextVersion,
      values: { clientReport: 'Keep my draft' },
      note: '',
      help: false,
      documentIds: [],
    };
    const saved = await saveResponseDraft(prisma, clientId, item.id, clientUserId, input);
    await prisma.planVersion.update({
      where: { id: created.versionId },
      data: { staleAt: new Date(), staleReason: 'Source review required' },
    });
    const paused = await getResponseDraft(prisma, clientId, item.id, clientUserId);
    expect(paused.active).toBe(false);
    expect(paused.draft?.values).toEqual(input.values);
    await expect(
      saveResponseDraft(prisma, clientId, item.id, clientUserId, {
        ...input,
        expectedRevision: saved.draft!.revision,
        values: { clientReport: 'Overwrite attempt' },
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONTEXT_CHANGED' });
    const retained = await getResponseDraft(prisma, clientId, item.id, clientUserId);
    expect(retained.draft?.values).toEqual(input.values);
    expect(retained.draft?.revision).toBe(saved.draft!.revision);
  });
  test('earlier draft recovery keeps original instructions and remains isolated from current answers', async () => {
    const input: PlanDraftInput = {
      title: 'Earlier draft access',
      purpose: 'PREPARATION',
      items: [
        {
          stableKey: 'response',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Original instructions',
          clientBody: 'Earlier preparation request',
          sortOrder: 0,
        },
      ],
    };
    const created = await createPlanDraft(prisma, clientId, input);
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const version = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!;
    const oldItem = version.items[0]!;
    const context = await getResponseDraft(prisma, clientId, oldItem.id, clientUserId);
    await saveResponseDraft(prisma, clientId, oldItem.id, clientUserId, {
      expectedRevision: 0,
      contextVersion: context.contextVersion,
      values: { clientReport: 'Earlier private answer' },
      note: 'Earlier note',
      help: false,
      documentIds: [],
    });
    await revisePlanDraft(prisma, created.planId, version.optimisticVersion, {
      ...input,
      items: [
        {
          ...input.items[0]!,
          clientTitle: 'Updated instructions',
          clientBody: 'Different preparation request',
        },
      ],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const current = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!
      .items[0]!;
    const recovered = await getResponseDraft(prisma, clientId, current.id, clientUserId);
    expect(recovered.draft).toBeNull();
    expect(recovered.previousDraft).toMatchObject({
      version: 1,
      title: 'Original instructions',
      body: 'Earlier preparation request',
      values: { clientReport: 'Earlier private answer' },
    });
    expect(
      (await getResponseDraft(prisma, clientId, current.id, consultantId)).previousDraft,
    ).toBeNull();
    await saveResponseDraft(prisma, clientId, current.id, clientUserId, {
      expectedRevision: 0,
      contextVersion: recovered.contextVersion,
      values: { clientReport: 'Current answer' },
      note: '',
      help: false,
      documentIds: [],
    });
    const both = await getResponseDraft(prisma, clientId, current.id, clientUserId);
    expect(both.draft?.values).toEqual({ clientReport: 'Current answer' });
    expect(both.previousDraft?.values).toEqual({ clientReport: 'Earlier private answer' });
    expect(
      await prisma.planItemOutcome.count({
        where: { planItemId: { in: [oldItem.id, current.id] } },
      }),
    ).toBe(0);
    await discardResponseDraft(prisma, clientId, oldItem.id, clientUserId, {
      draftId: recovered.previousDraft!.id,
      revision: recovered.previousDraft!.revision,
    });
    const afterDiscard = await getResponseDraft(prisma, clientId, current.id, clientUserId);
    expect(afterDiscard.previousDraft).toBeNull();
    expect(afterDiscard.draft?.values).toEqual({ clientReport: 'Current answer' });
    const separate = await createPlanDraft(prisma, clientId, input);
    await approvePlan(prisma, clientId, separate.planId, consultantId);
    const unrelated = (await getPlanBuilder(prisma, clientId, separate.planId)).plan!.versions[0]!
      .items[0]!;
    expect(
      (await getResponseDraft(prisma, clientId, unrelated.id, clientUserId)).previousDraft,
    ).toBeNull();
  });
  test('discard protects newer and recreated drafts and remains scoped to their owner', async () => {
    const created = await createPlanDraft(prisma, clientId, {
      title: 'Discard protection',
      purpose: 'PREPARATION',
      items: [
        {
          stableKey: 'response',
          type: 'ACTION',
          owner: 'CLIENT',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          clientTitle: 'Prepare response',
          sortOrder: 0,
        },
      ],
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const item = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!
      .items[0]!;
    const context = await getResponseDraft(prisma, clientId, item.id, clientUserId);
    const input = {
      expectedRevision: 0,
      contextVersion: context.contextVersion,
      values: { clientReport: 'Keep me' },
      note: '',
      help: false,
      documentIds: [],
    };
    const first = (await saveResponseDraft(prisma, clientId, item.id, clientUserId, input)).draft!;
    await expect(
      discardResponseDraft(prisma, randomUUID(), item.id, clientUserId, {
        draftId: first.id,
        revision: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await discardResponseDraft(prisma, clientId, item.id, consultantId, {
      draftId: first.id,
      revision: 1,
    });
    expect((await getResponseDraft(prisma, clientId, item.id, clientUserId)).draft?.id).toBe(
      first.id,
    );
    const updated = (
      await saveResponseDraft(prisma, clientId, item.id, clientUserId, {
        ...input,
        expectedRevision: 1,
      })
    ).draft!;
    await expect(
      discardResponseDraft(prisma, clientId, item.id, clientUserId, {
        draftId: first.id,
        revision: 1,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    await discardResponseDraft(prisma, clientId, item.id, clientUserId, {
      draftId: updated.id,
      revision: updated.revision,
    });
    expect((await getResponseDraft(prisma, clientId, item.id, clientUserId)).draft).toBeNull();
    expect(
      await discardResponseDraft(prisma, clientId, item.id, clientUserId, {
        draftId: updated.id,
        revision: updated.revision,
      }),
    ).toEqual({ discarded: true });
    const recreated = (await saveResponseDraft(prisma, clientId, item.id, clientUserId, input))
      .draft!;
    expect(recreated.revision).toBe(1);
    await expect(
      saveResponseDraft(prisma, clientId, item.id, clientUserId, {
        ...input,
        expectedRevision: 1,
        expectedDraftId: first.id,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    await expect(
      executePlanItem(prisma, {
        clientId,
        itemId: item.id,
        actorId: clientUserId,
        action: 'COMPLETE',
        idempotencyKey: randomUUID(),
        draftRevision: 1,
        draftId: first.id,
        outcome: { clientReport: 'Do not replace newer work' },
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    expect(await prisma.planItemOutcome.count({ where: { planItemId: item.id } })).toBe(0);

    await expect(
      discardResponseDraft(prisma, clientId, item.id, clientUserId, {
        draftId: first.id,
        revision: 1,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_DRAFT_CONFLICT' });
    expect((await getResponseDraft(prisma, clientId, item.id, clientUserId)).draft?.id).toBe(
      recreated.id,
    );
  });
  test('draft library recovers removed steps and paginates after its cursor record is discarded', async () => {
    const input: PlanDraftInput = {
      title: 'Draft library original',
      purpose: 'PREPARATION',
      items: Array.from({ length: 22 }, (_, index) => ({
        stableKey: `library-${index}`,
        type: 'ACTION',
        owner: 'CLIENT',
        completionMode: 'ACKNOWLEDGEMENT',
        clientTitle: `Saved step ${index}`,
        consultantRationale: 'Never client-visible',
        sortOrder: index,
      })),
    };
    const created = await createPlanDraft(prisma, clientId, input);
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const version = (await getPlanBuilder(prisma, clientId, created.planId)).plan!.versions[0]!;
    await prisma.planResponseDraft.createMany({
      data: version.items.map((item) => ({
        itemId: item.id,
        actorId: clientUserId,
        values: {},
        note: 'Saved library answer',
        help: false,
        documentIds: [],
      })),
    });
    await revisePlanDraft(prisma, created.planId, version.optimisticVersion, {
      ...input,
      items: input.items.slice(1),
    });
    await approvePlan(prisma, clientId, created.planId, consultantId);
    const first = await listResponseDrafts(prisma, clientId, clientUserId);
    expect(first.drafts).toHaveLength(20);
    expect(first.nextBefore).toBeTruthy();
    const cursor = first.drafts.at(-1)!;
    await discardResponseDraft(prisma, clientId, cursor.itemId, clientUserId, {
      draftId: cursor.id,
      revision: cursor.revision,
    });
    const second = await listResponseDrafts(prisma, clientId, clientUserId, first.nextBefore!);
    const all = [...first.drafts, ...second.drafts];
    expect(new Set(all.map((row) => row.id)).size).toBe(all.length);
    expect(
      all.some((row) => row.itemId === version.items[0]!.id && row.title === 'Saved step 0'),
    ).toBe(true);
    expect(JSON.stringify(all)).not.toContain('Never client-visible');
    expect((await listResponseDrafts(prisma, randomUUID(), clientUserId)).drafts).toEqual([]);
    expect((await listResponseDrafts(prisma, clientId, randomUUID())).drafts).toEqual([]);
  });
});
