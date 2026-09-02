import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { validatePlanGraph } from './validation.js';
import { prerequisitesSatisfied } from './validation.js';

export type PlanItemInput = {
  stableKey: string;
  type: 'ACTION' | 'GUIDANCE' | 'MILESTONE';
  completionMode:
    | 'ACKNOWLEDGEMENT'
    | 'STRUCTURED_OUTCOME'
    | 'CLIENT_REPORT_CONSULTANT_VERIFY'
    | 'CONSULTANT_VERIFY'
    | 'SYSTEM_VERIFY';
  owner: 'CLIENT' | 'CONSULTANT' | 'SYSTEM';
  clientTitle: string;
  clientBody?: string | null;
  consultantRationale?: string | null;
  sortOrder: number;
  required?: boolean;
  deepLink?: string | null;
  outcomeSchema?: Prisma.InputJsonValue;
  manuallyProtected?: boolean;
  pathKeys?: string[];
};

export type PlanPathInput = {
  key: string;
  clientLabel: string;
  internalLabel?: string | null;
  status: 'AVAILABLE' | 'ACTIVE' | 'INACTIVE' | 'RETIRED';
  sortOrder: number;
};

export type PlanDependencyInput = {
  dependentKey: string;
  prerequisiteKey: string;
  groupKey?: string;
  mode?: 'ALL' | 'ANY';
};

export type PlanDraftInput = {
  title: string;
  purpose: 'PREPARATION' | 'NURTURE' | 'POST_ROUND' | 'MAJOR_READINESS';
  sourceReviewId?: string | null;
  sourceReviewVersion?: number | null;
  sourceGoalRevisionId?: string | null;
  sourceProfileVersion?: number | null;
  items: PlanItemInput[];
  paths?: PlanPathInput[];
  dependencies?: PlanDependencyInput[];
};

export function sourceFingerprint(input: Pick<PlanDraftInput, 'sourceReviewId' | 'sourceReviewVersion' | 'sourceGoalRevisionId' | 'sourceProfileVersion'>) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function graphInput(input: PlanDraftInput) {
  return {
    items: input.items.map((item) => ({
      id: item.stableKey,
      type: item.type,
      completionMode: item.completionMode,
      required: item.required ?? true,
      pathKeys: item.pathKeys ?? [],
    })),
    dependencies: (input.dependencies ?? []).map((edge) => ({
      dependentItemId: edge.dependentKey,
      prerequisiteItemId: edge.prerequisiteKey,
      groupKey: edge.groupKey ?? 'default',
      mode: edge.mode ?? 'ALL',
    })),
    activePathKeys: (input.paths ?? []).filter((path) => path.status === 'ACTIVE').map((path) => path.key),
  };
}

function assertValid(input: PlanDraftInput) {
  const result = validatePlanGraph(graphInput(input));
  if (!result.valid)
    throw new AppError(
      'PLAN_INVALID',
      409,
      `Plan validation failed: ${result.issues.map(({ message }) => message).join(' ')}`,
    );
  if (!input.items.length) throw new AppError('PLAN_INVALID', 409, 'Plan must contain at least one item');
}

async function writeVersion(
  tx: Prisma.TransactionClient,
  planId: string,
  version: number,
  input: PlanDraftInput,
  supersedesVersionId?: string,
) {
  const record = await tx.planVersion.create({
    data: {
      planId,
      version,
      status: 'DRAFT',
      sourceReviewId: input.sourceReviewId ?? null,
      sourceReviewVersion: input.sourceReviewVersion ?? null,
      sourceGoalRevisionId: input.sourceGoalRevisionId ?? null,
      sourceProfileVersion: input.sourceProfileVersion ?? null,
      sourceFingerprint: sourceFingerprint(input),
      supersedesVersionId: supersedesVersionId ?? null,
    },
  });
  const itemIds = new Map<string, string>();
  for (const item of input.items) {
    const created = await tx.planItem.create({
      data: {
        planVersionId: record.id,
        stableKey: item.stableKey,
        type: item.type,
        completionMode: item.completionMode,
        owner: item.owner,
        clientTitle: item.clientTitle,
        clientBody: item.clientBody ?? null,
        consultantRationale: item.consultantRationale ?? null,
        sortOrder: item.sortOrder,
        required: item.required ?? true,
        deepLink: item.deepLink ?? null,
        ...(item.outcomeSchema === undefined ? {} : { outcomeSchema: item.outcomeSchema }),
        manuallyProtected: item.manuallyProtected ?? false,
        status: 'LOCKED',
      },
    });
    itemIds.set(item.stableKey, created.id);
  }
  const paths = new Map<string, string>();
  for (const path of input.paths ?? []) {
    const created = await tx.planPath.create({
      data: { planVersionId: record.id, ...path },
    });
    paths.set(path.key, created.id);
  }
  for (const item of input.items) {
    for (const key of item.pathKeys ?? [])
      await tx.planPathItem.create({ data: { itemId: itemIds.get(item.stableKey)!, pathId: paths.get(key)! } });
  }
  for (const edge of input.dependencies ?? [])
    await tx.planDependency.create({
      data: {
        dependentItemId: itemIds.get(edge.dependentKey)!,
        prerequisiteItemId: itemIds.get(edge.prerequisiteKey)!,
        groupKey: edge.groupKey ?? 'default',
        mode: edge.mode ?? 'ALL',
      },
    });
  return record;
}

export async function createPlanDraft(prisma: PrismaClient, clientId: string, input: PlanDraftInput) {
  assertValid(input);
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({ data: { clientId, purpose: input.purpose, title: input.title } });
    const version = await writeVersion(tx, plan.id, 1, input);
    return { planId: plan.id, versionId: version.id, version: 1, optimisticVersion: 1 };
  });
}

export async function revisePlanDraft(
  prisma: PrismaClient,
  planId: string,
  expectedVersion: number,
  input: PlanDraftInput,
) {
  assertValid(input);
  return prisma.$transaction(async (tx) => {
    const latest = await tx.planVersion.findFirst({ where: { planId }, orderBy: { version: 'desc' } });
    if (!latest) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
    if (latest.optimisticVersion !== expectedVersion)
      throw new AppError('VERSION_CONFLICT', 409, 'Plan changed; reload before saving');
    if (latest.status === 'DRAFT') {
      const claimed = await tx.planVersion.updateMany({
        where: { id: latest.id, optimisticVersion: expectedVersion, status: 'DRAFT' },
        data: { optimisticVersion: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new AppError('VERSION_CONFLICT', 409, 'Plan changed; reload before saving');
      await tx.planDependency.deleteMany({ where: { dependentItem: { planVersionId: latest.id } } });
      await tx.planPathItem.deleteMany({ where: { item: { planVersionId: latest.id } } });
      await tx.planPath.deleteMany({ where: { planVersionId: latest.id } });
      await tx.planItem.deleteMany({ where: { planVersionId: latest.id } });
      await tx.planVersion.update({
        where: { id: latest.id },
        data: {
          sourceReviewId: input.sourceReviewId ?? null,
          sourceReviewVersion: input.sourceReviewVersion ?? null,
          sourceGoalRevisionId: input.sourceGoalRevisionId ?? null,
          sourceProfileVersion: input.sourceProfileVersion ?? null,
          sourceFingerprint: sourceFingerprint(input),
        },
      });
      const rebuilt = await writeVersion(tx, planId, latest.version + 1, input, latest.supersedesVersionId ?? undefined);
      await tx.planVersion.delete({ where: { id: latest.id } });
      return { versionId: rebuilt.id, version: rebuilt.version, optimisticVersion: rebuilt.optimisticVersion };
    }
    const next = await writeVersion(tx, planId, latest.version + 1, input, latest.id);
    return { versionId: next.id, version: next.version, optimisticVersion: next.optimisticVersion };
  });
}

const builderInclude = {
  items: {
    include: { pathMemberships: { include: { path: true } }, prerequisites: { include: { prerequisiteItem: true } } },
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  paths: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
};

export async function getPlanBuilder(prisma: PrismaClient, clientId: string) {
  const plan = await prisma.plan.findFirst({
    where: { clientId, status: { not: 'CANCELLED' } },
    include: { versions: { include: builderInclude, orderBy: { version: 'desc' }, take: 2 } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  const [goal, review, journey] = await Promise.all([
    prisma.clientGoal.findFirst({ where: { clientId, status: 'ACTIVE' }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
    prisma.creditReview.findFirst({ where: { clientId, status: 'COMPLETE' }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }] }),
    prisma.creditJourney.findUnique({ where: { clientId }, include: { nurturePeriods: { where: { status: 'ACTIVE' }, take: 1 } } }),
  ]);
  return { plan, context: { goal, review, journey } };
}

export function clientSafeVersion(
  version: NonNullable<Awaited<ReturnType<typeof getPlanBuilder>>['plan']>['versions'][number],
) {
  const activePaths = new Set(version.paths.filter((path) => ['ACTIVE', 'AVAILABLE'].includes(path.status)).map((path) => path.id));
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    staleAt: version.staleAt,
    staleReason: version.staleReason,
    items: version.items
      .filter((item) => !item.pathMemberships.length || item.pathMemberships.some(({ pathId }) => activePaths.has(pathId)))
      .map((item) => ({
        id: item.id,
        stableKey: item.stableKey,
        type: item.type,
        completionMode: item.completionMode,
        status: item.status,
        owner: item.owner,
        title: item.clientTitle,
        body: item.clientBody,
        sortOrder: item.sortOrder,
        dueAt: item.dueAt,
        deepLink: item.deepLink,
        prerequisites: item.prerequisites.map(({ prerequisiteItem }) => ({ id: prerequisiteItem.id, title: prerequisiteItem.clientTitle, status: prerequisiteItem.status })),
      })),
    paths: version.paths.filter((path) => activePaths.has(path.id)).map((path) => ({ key: path.key, label: path.clientLabel, status: path.status })),
  };
}

export async function approvePlan(prisma: PrismaClient, clientId: string, planId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findFirst({ where: { id: planId, clientId }, include: { versions: { include: builderInclude, orderBy: { version: 'desc' }, take: 1 } } });
    if (!plan || !plan.versions[0]) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
    const version = plan.versions[0];
    if (version.status !== 'DRAFT') throw new AppError('PLAN_IMMUTABLE', 409, 'Only a draft Plan can be approved');
    const input: PlanDraftInput = {
      title: plan.title,
      purpose: plan.purpose,
      sourceReviewId: version.sourceReviewId,
      sourceReviewVersion: version.sourceReviewVersion,
      sourceGoalRevisionId: version.sourceGoalRevisionId,
      sourceProfileVersion: version.sourceProfileVersion,
      paths: version.paths.map((path) => ({ key: path.key, clientLabel: path.clientLabel, internalLabel: path.internalLabel, status: path.status, sortOrder: path.sortOrder })),
      items: version.items.map((item) => ({ stableKey: item.stableKey, type: item.type, completionMode: item.completionMode, owner: item.owner, clientTitle: item.clientTitle, clientBody: item.clientBody, consultantRationale: item.consultantRationale, sortOrder: item.sortOrder, required: item.required, pathKeys: item.pathMemberships.map(({ path }) => path.key) })),
      dependencies: version.items.flatMap((item) => item.prerequisites.map((edge) => ({ dependentKey: item.stableKey, prerequisiteKey: edge.prerequisiteItem.stableKey, groupKey: edge.groupKey, mode: edge.mode }))),
    };
    assertValid(input);
    await tx.planVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE', approvedById: actorId, approvedAt: new Date(), activatedAt: new Date() } });
    await tx.plan.update({ where: { id: planId }, data: { status: 'ACTIVE' } });
    const roots = version.items.filter((item) => item.prerequisites.length === 0);
    await tx.planItem.updateMany({ where: { id: { in: roots.map(({ id }) => id) } }, data: { status: 'AVAILABLE' } });
    await tx.auditEvent.create({ data: { clientId, actorId, action: 'plan.approved', entityType: 'PlanVersion', entityId: version.id } });
    await tx.outboxEvent.create({ data: { eventType: 'plan.approved', eventKey: `plan-approved:${version.id}`, aggregateType: 'Plan', aggregateId: planId, payload: { clientId, domains: ['plan', 'journey', 'home'] } } });
    return { planId, versionId: version.id, version: version.version };
  });
}

export async function executePlanItem(
  prisma: PrismaClient,
  input: {
    clientId: string;
    itemId: string;
    actorId: string;
    idempotencyKey: string;
    action: 'COMPLETE' | 'UNABLE';
    outcome?: Prisma.InputJsonValue;
    reason?: string;
  },
) {
  const existing = await prisma.planItemOutcome.findUnique({
    where: { planItemId_idempotencyKey: { planItemId: input.itemId, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return { replayed: true, outcomeId: existing.id };
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.planItem.findFirst({
        where: { id: input.itemId, planVersion: { plan: { clientId: input.clientId } } },
        include: {
          planVersion: { include: { plan: true } },
          prerequisites: true,
        },
      });
      if (!item) throw new AppError('NOT_FOUND', 404, 'Plan item was not found');
      if (item.planVersion.status !== 'ACTIVE' || item.planVersion.plan.status !== 'ACTIVE')
        throw new AppError('PLAN_NOT_ACTIVE', 409, 'This Plan is no longer available for new outcomes');
      if (item.status !== 'AVAILABLE' && item.status !== 'IN_PROGRESS')
        throw new AppError('PLAN_ITEM_LOCKED', 409, 'Complete the required earlier steps first');
      if (item.type === 'MILESTONE' || ['CONSULTANT_VERIFY', 'SYSTEM_VERIFY'].includes(item.completionMode))
        throw new AppError('PLAN_ITEM_VERIFICATION_REQUIRED', 403, 'This step requires authoritative verification');
      if (item.completionMode === 'STRUCTURED_OUTCOME' && input.action === 'COMPLETE' && input.outcome === undefined)
        throw new AppError('OUTCOME_REQUIRED', 422, 'A structured outcome is required');

      const outcome = await tx.planItemOutcome.create({
        data: {
          planItemId: item.id,
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          kind: input.action,
          ...(input.outcome === undefined
            ? input.reason
              ? { data: { reason: input.reason } }
              : {}
            : { data: input.outcome }),
        },
      });
      const nextStatus =
        input.action === 'UNABLE'
          ? 'UNABLE'
          : item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY'
            ? 'AWAITING_VERIFICATION'
            : 'COMPLETED';
      await tx.planItem.update({
        where: { id: item.id },
        data: {
          status: nextStatus,
          ...(nextStatus === 'COMPLETED' ? { completedAt: new Date() } : {}),
          ...(item.type === 'GUIDANCE' ? { acknowledgedAt: new Date() } : {}),
        },
      });
      if (item.completionMode === 'STRUCTURED_OUTCOME' && input.action === 'COMPLETE')
        await tx.clientUpdate.create({
          data: {
            clientId: input.clientId,
            sourceKey: `plan-outcome:${outcome.id}`,
            category: 'OTHER',
            source: 'CLIENT_DECLARED',
            subject: item.clientTitle,
            details: 'Structured Plan outcome recorded.',
            provenance: { planItemId: item.id, outcomeId: outcome.id, data: input.outcome },
          },
        });
      if (nextStatus === 'UNABLE' || nextStatus === 'AWAITING_VERIFICATION')
        await tx.workItem.create({
          data: {
            clientId: input.clientId,
            title: nextStatus === 'UNABLE' ? `Client needs help: ${item.clientTitle}` : `Verify Plan step: ${item.clientTitle}`,
            domain: 'PLAN',
            authority: 'ATTENTION_PROJECTION',
            sourceType: 'PlanItem',
            sourceId: item.id,
            reasonCode: nextStatus,
            dedupeKey: `plan-item:${item.id}:${nextStatus}`,
            deepLink: { route: `/crm/clients/${input.clientId}/plan` },
            neededSince: new Date(),
          },
        });
      await tx.auditEvent.create({ data: { clientId: input.clientId, actorId: input.actorId, action: `plan.item.${input.action.toLowerCase()}`, entityType: 'PlanItem', entityId: item.id, correlationId: input.idempotencyKey } });
      await tx.outboxEvent.create({ data: { eventType: 'plan.item.changed', eventKey: `plan-item:${item.id}:${input.idempotencyKey}`, aggregateType: 'Plan', aggregateId: item.planVersion.planId, payload: { clientId: input.clientId, domains: ['plan', 'home', 'journey', 'credit-center', 'work-queue'] } } });

      if (nextStatus === 'COMPLETED') {
        const versionItems = await tx.planItem.findMany({ where: { planVersionId: item.planVersionId }, include: { prerequisites: true } });
        const completed = new Set(versionItems.filter(({ status }) => status === 'COMPLETED').map(({ id }) => id));
        const dependencies = versionItems.flatMap((candidate) => candidate.prerequisites.map((edge) => ({ dependentItemId: candidate.id, prerequisiteItemId: edge.prerequisiteItemId, groupKey: edge.groupKey, mode: edge.mode })));
        const unlockIds = versionItems.filter((candidate) => candidate.status === 'LOCKED' && prerequisitesSatisfied(candidate.id, dependencies, completed)).map(({ id }) => id);
        if (unlockIds.length) await tx.planItem.updateMany({ where: { id: { in: unlockIds } }, data: { status: 'AVAILABLE' } });
      }
      return { replayed: false, outcomeId: outcome.id, status: nextStatus };
    });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const replay = await prisma.planItemOutcome.findUniqueOrThrow({ where: { planItemId_idempotencyKey: { planItemId: input.itemId, idempotencyKey: input.idempotencyKey } } });
      return { replayed: true, outcomeId: replay.id };
    }
    throw error;
  }
}

export async function verifyPlanItem(prisma: PrismaClient, clientId: string, itemId: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.planItem.findFirst({ where: { id: itemId, planVersion: { plan: { clientId, status: 'ACTIVE' }, status: 'ACTIVE' } }, include: { planVersion: true } });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Plan item was not found');
    if (!['AWAITING_VERIFICATION', 'AVAILABLE'].includes(item.status) || !['CLIENT_REPORT_CONSULTANT_VERIFY', 'CONSULTANT_VERIFY'].includes(item.completionMode))
      throw new AppError('INVALID_PLAN_ITEM_STATE', 409, 'This item is not awaiting consultant verification');
    await tx.planItem.update({ where: { id: item.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.workItem.updateMany({ where: { sourceType: 'PlanItem', sourceId: item.id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completedAt: new Date(), resolvedAt: new Date() } });
    await tx.auditEvent.create({ data: { clientId, actorId, action: 'plan.item.verified', entityType: 'PlanItem', entityId: item.id } });
    await tx.outboxEvent.create({ data: { eventType: 'plan.item.verified', eventKey: `plan-item-verified:${item.id}`, aggregateType: 'Plan', aggregateId: item.planVersion.planId, payload: { clientId, domains: ['plan', 'home', 'journey', 'work-queue'] } } });
    return { itemId: item.id, status: 'COMPLETED' as const };
  });
}
