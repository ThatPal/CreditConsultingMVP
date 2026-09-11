import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { validatePlanGraph } from './validation.js';
import { prerequisitesSatisfied } from './validation.js';
import { clientResponseForm, responseFields, validateResponse } from './outcomes.js';
import { preparePlanAttachments } from './attachments.js';
import {
  assertPlanSourceOwnership,
  assertPlanSourcesCurrent,
  comparePlanSources,
  currentPlanSources,
  sourceFingerprint,
} from './sources.js';
export { sourceFingerprint } from './sources.js';

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

function graphInput(input: PlanDraftInput) {
  return {
    items: input.items.map((item) => ({
      id: item.stableKey,
      type: item.type,
      completionMode: item.completionMode,
      owner: item.owner,
      required: item.required ?? true,
      pathKeys: item.pathKeys ?? [],
    })),
    dependencies: (input.dependencies ?? []).map((edge) => ({
      dependentItemId: edge.dependentKey,
      prerequisiteItemId: edge.prerequisiteKey,
      groupKey: edge.groupKey ?? 'default',
      mode: edge.mode ?? 'ALL',
    })),
    activePathKeys: (input.paths ?? [])
      .filter((path) => path.status === 'ACTIVE')
      .map((path) => path.key),
  };
}

function assertValid(input: PlanDraftInput) {
  const paths = new Set((input.paths ?? []).map((path) => path.key));
  if (
    paths.size !== (input.paths ?? []).length ||
    input.items.some((item) => (item.pathKeys ?? []).some((key) => !paths.has(key)))
  )
    throw new AppError(
      'PLAN_INVALID',
      409,
      'Every path must have a unique identity and every step must reference an existing path.',
    );
  const result = validatePlanGraph(graphInput(input));
  if (!result.valid)
    throw new AppError(
      'PLAN_INVALID',
      409,
      `Plan validation failed: ${result.issues.map(({ message }) => message).join(' ')}`,
    );
  if (!input.items.length)
    throw new AppError('PLAN_INVALID', 409, 'Plan must contain at least one item');
}

async function lockPlan(tx: Prisma.TransactionClient, planId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Plan" WHERE "id" = ${planId}::uuid FOR UPDATE`;
}

async function lockItemPlan(tx: Prisma.TransactionClient, itemId: string, clientId: string) {
  await tx.$queryRaw`SELECT p."id" FROM "Plan" p JOIN "PlanVersion" v ON v."planId" = p."id" JOIN "PlanItem" i ON i."planVersionId" = v."id" WHERE i."id" = ${itemId}::uuid AND p."clientId" = ${clientId}::uuid FOR UPDATE OF p`;
}

const progressStates = ['COMPLETED', 'AWAITING_VERIFICATION', 'UNABLE', 'IN_PROGRESS', 'CANCELLED'];

function itemContract(item: PlanItemInput, dependencies: PlanDependencyInput[]) {
  return JSON.stringify({
    type: item.type,
    completionMode: item.completionMode,
    owner: item.owner,
    clientTitle: item.clientTitle,
    clientBody: item.clientBody ?? null,
    required: item.required ?? true,
    deepLink: item.deepLink ?? null,
    outcomeSchema: item.outcomeSchema ?? null,
    pathKeys: [...(item.pathKeys ?? [])].sort(),
    prerequisites: dependencies
      .filter((edge) => edge.dependentKey === item.stableKey)
      .map((edge) => `${edge.prerequisiteKey}:${edge.groupKey ?? 'default'}:${edge.mode ?? 'ALL'}`)
      .sort(),
  });
}

async function carryProgress(
  tx: Prisma.TransactionClient,
  sourceVersionId: string,
  targetVersionId: string,
  input: PlanDraftInput,
) {
  const previous = await tx.planVersion.findUniqueOrThrow({
    where: { id: sourceVersionId },
    include: builderInclude,
  });
  const dependencies = previous.items.flatMap((item) =>
    item.prerequisites.map((edge) => ({
      dependentKey: item.stableKey,
      prerequisiteKey: edge.prerequisiteItem.stableKey,
      groupKey: edge.groupKey,
      mode: edge.mode,
    })),
  );
  for (const item of previous.items.filter((entry) => progressStates.includes(entry.status))) {
    const next = input.items.find((entry) => entry.stableKey === item.stableKey);
    const before = {
      ...item,
      outcomeSchema: item.outcomeSchema ?? undefined,
      pathKeys: item.pathMemberships.map(({ path }) => path.key),
    };
    if (
      !next ||
      itemContract(before as PlanItemInput, dependencies) !==
        itemContract(next, input.dependencies ?? [])
    )
      throw new AppError(
        'PLAN_PROGRESS_PROTECTED',
        409,
        `"${item.clientTitle}" has recorded progress. Keep this step unchanged and add a new step for different instructions.`,
      );
    await tx.planItem.updateMany({
      where: { planVersionId: targetVersionId, stableKey: item.stableKey },
      data: {
        status: item.status,
        completedAt: item.completedAt,
        acknowledgedAt: item.acknowledgedAt,
      },
    });
  }
}

async function writeItems(tx: Prisma.TransactionClient, versionId: string, input: PlanDraftInput) {
  // Rebuild edges and memberships, but retain item IDs, timestamps and execution
  // records. A draft save is an edit, not a new publication.
  await tx.planDependency.deleteMany({ where: { dependentItem: { planVersionId: versionId } } });
  await tx.planPathItem.deleteMany({ where: { item: { planVersionId: versionId } } });
  await tx.planPath.deleteMany({ where: { planVersionId: versionId } });
  const itemIds = new Map<string, string>();
  for (const item of input.items) {
    const data = {
      type: item.type,
      completionMode: item.completionMode,
      owner: item.owner,
      clientTitle: item.clientTitle,
      clientBody: item.clientBody ?? null,
      consultantRationale: item.consultantRationale ?? null,
      sortOrder: item.sortOrder,
      required: item.required ?? true,
      deepLink: item.deepLink ?? null,
      outcomeSchema: item.outcomeSchema ?? Prisma.JsonNull,
      manuallyProtected: item.manuallyProtected ?? false,
    };
    const record = await tx.planItem.upsert({
      where: { planVersionId_stableKey: { planVersionId: versionId, stableKey: item.stableKey } },
      create: { ...data, planVersionId: versionId, stableKey: item.stableKey, status: 'LOCKED' },
      update: data,
    });
    itemIds.set(item.stableKey, record.id);
  }
  await tx.planItem.deleteMany({
    where: {
      planVersionId: versionId,
      stableKey: { notIn: input.items.map((item) => item.stableKey) },
    },
  });
  const paths = new Map<string, string>();
  for (const path of input.paths ?? []) {
    const record = await tx.planPath.create({ data: { planVersionId: versionId, ...path } });
    paths.set(path.key, record.id);
  }
  for (const item of input.items)
    for (const key of item.pathKeys ?? [])
      await tx.planPathItem.create({
        data: { itemId: itemIds.get(item.stableKey)!, pathId: paths.get(key)! },
      });
  for (const edge of input.dependencies ?? [])
    await tx.planDependency.create({
      data: {
        dependentItemId: itemIds.get(edge.dependentKey)!,
        prerequisiteItemId: itemIds.get(edge.prerequisiteKey)!,
        groupKey: edge.groupKey ?? 'default',
        mode: edge.mode ?? 'ALL',
      },
    });
}

async function writeVersion(
  tx: Prisma.TransactionClient,
  planId: string,
  version: number,
  input: PlanDraftInput,
  supersedesVersionId?: string,
  optimisticVersion = 1,
) {
  const record = await tx.planVersion.create({
    data: {
      planId,
      version,
      title: input.title,
      purpose: input.purpose,
      status: 'DRAFT',
      sourceReviewId: input.sourceReviewId ?? null,
      sourceReviewVersion: input.sourceReviewVersion ?? null,
      sourceGoalRevisionId: input.sourceGoalRevisionId ?? null,
      sourceProfileVersion: input.sourceProfileVersion ?? null,
      sourceFingerprint: sourceFingerprint(input),
      supersedesVersionId: supersedesVersionId ?? null,
      optimisticVersion,
    },
  });
  await writeItems(tx, record.id, input);
  if (supersedesVersionId) await carryProgress(tx, supersedesVersionId, record.id, input);
  return record;
}

export async function createPlanDraft(
  prisma: PrismaClient,
  clientId: string,
  input: PlanDraftInput,
) {
  assertValid(input);
  return prisma.$transaction(async (tx) => {
    await assertPlanSourceOwnership(tx, clientId, input);
    const plan = await tx.plan.create({
      data: { clientId, purpose: input.purpose, title: input.title },
    });
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
    await lockPlan(tx, planId);
    const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
    await assertPlanSourceOwnership(tx, plan.clientId, input);
    const latest = await tx.planVersion.findFirst({
      where: { planId },
      orderBy: { version: 'desc' },
    });
    if (!latest) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
    if (latest.optimisticVersion !== expectedVersion)
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'Someone saved a newer Plan. Your edits have not been applied.',
      );
    await tx.plan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
    if (latest.status === 'DRAFT') {
      await carryProgress(tx, latest.id, latest.id, input);
      await writeItems(tx, latest.id, input);
      const saved = await tx.planVersion.update({
        where: { id: latest.id },
        data: {
          title: input.title,
          purpose: input.purpose,
          optimisticVersion: { increment: 1 },
          sourceReviewId: input.sourceReviewId ?? null,
          sourceReviewVersion: input.sourceReviewVersion ?? null,
          sourceGoalRevisionId: input.sourceGoalRevisionId ?? null,
          sourceProfileVersion: input.sourceProfileVersion ?? null,
          sourceFingerprint: sourceFingerprint(input),
        },
      });
      return {
        versionId: saved.id,
        version: saved.version,
        optimisticVersion: saved.optimisticVersion,
      };
    }
    if (!['ACTIVE', 'APPROVED', 'STALE', 'COMPLETED'].includes(latest.status))
      throw new AppError('PLAN_IMMUTABLE', 409, 'This Plan cannot be revised.');
    const next = await writeVersion(
      tx,
      planId,
      latest.version + 1,
      input,
      latest.id,
      latest.optimisticVersion + 1,
    );
    return { versionId: next.id, version: next.version, optimisticVersion: next.optimisticVersion };
  });
}

const builderInclude = {
  items: {
    include: {
      pathMemberships: { include: { path: true } },
      prerequisites: { include: { prerequisiteItem: true } },
    },
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
    prisma.clientGoal.findFirst({
      where: { clientId, status: 'ACTIVE' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.creditReview.findFirst({
      where: { clientId, status: 'COMPLETE' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.creditJourney.findUnique({
      where: { clientId },
      include: { nurturePeriods: { where: { status: 'ACTIVE' }, take: 1 } },
    }),
  ]);
  const [publication, goalRevision] = await Promise.all([
    prisma.publishedCreditReview.findFirst({
      where: { clientId },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: { reviewId: true },
    }),
    goal
      ? prisma.clientGoalRevision.findFirst({
          where: { goalId: goal.id, clientId },
          orderBy: { version: 'desc' },
          select: { id: true },
        })
      : null,
  ]);
  // A publication is immutable and identified by reviewId. There is currently
  // no numeric published-profile version; do not manufacture one in the editor.
  const sources = {
    sourceReviewId: publication?.reviewId ?? null,
    sourceReviewVersion: null,
    sourceGoalRevisionId: goalRevision?.id ?? null,
    sourceProfileVersion: null,
  };
  return { plan, context: { goal, review, journey, sources } };
}

// Select the published version directly. A newer draft must not hide the
// client's existing Plan, and an arbitrary version window is not a visibility rule.
export async function getClientPlan(prisma: PrismaClient, clientId: string) {
  const plan = await prisma.plan.findFirst({
    where: {
      clientId,
      status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
      versions: { some: { status: { in: ['ACTIVE', 'APPROVED', 'STALE', 'COMPLETED'] } } },
    },
    include: {
      versions: {
        where: { status: { in: ['ACTIVE', 'APPROVED', 'STALE', 'COMPLETED'] } },
        include: builderInclude,
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });
  const version = plan?.versions[0];
  return {
    plan:
      plan && version
        ? {
            id: plan.id,
            title: version.title ?? plan.title,
            purpose: version.purpose ?? plan.purpose,
            status: version.status,
            version: {
              ...clientSafeVersion(version),
              items: await Promise.all(
                clientSafeVersion(version).items.map(async (item) => ({
                  ...item,
                  ...(await itemHistory(prisma, plan.id, version.version, item.stableKey)),
                })),
              ),
            },
          }
        : null,
  };
}

export function clientSafeVersion(
  version: NonNullable<Awaited<ReturnType<typeof getPlanBuilder>>['plan']>['versions'][number],
) {
  const activePaths = new Set(
    version.paths
      .filter((path) => ['ACTIVE', 'AVAILABLE'].includes(path.status))
      .map((path) => path.id),
  );
  return {
    id: version.id,
    version: version.version,
    status: version.status,
    staleAt: version.staleAt,
    staleReason: version.staleReason,
    items: version.items
      .filter(
        (item) =>
          !item.pathMemberships.length ||
          item.pathMemberships.some(({ pathId }) => activePaths.has(pathId)),
      )
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
        responseForm: clientResponseForm(item.outcomeSchema, item.completionMode),
        prerequisites: item.prerequisites.map(({ prerequisiteItem }) => ({
          id: prerequisiteItem.id,
          title: prerequisiteItem.clientTitle,
          status: prerequisiteItem.status,
        })),
      })),
    paths: version.paths
      .filter((path) => activePaths.has(path.id))
      .map((path) => ({ key: path.key, label: path.clientLabel, status: path.status })),
  };
}

export async function approvePlan(
  prisma: PrismaClient,
  clientId: string,
  planId: string,
  actorId: string,
  expectedVersion?: number,
) {
  return prisma.$transaction(async (tx) => {
    await lockPlan(tx, planId);
    const plan = await tx.plan.findFirst({
      where: { id: planId, clientId },
      include: { versions: { include: builderInclude, orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!plan || !plan.versions[0]) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
    const version = plan.versions[0];
    if (expectedVersion !== undefined && version.optimisticVersion !== expectedVersion)
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'The draft changed after you reviewed it. Reload before approving.',
      );
    await assertPlanSourcesCurrent(tx, clientId, version);
    if (version.status !== 'DRAFT')
      throw new AppError('PLAN_IMMUTABLE', 409, 'Only a draft Plan can be approved');
    const input: PlanDraftInput = {
      title: version.title ?? plan.title,
      purpose: version.purpose ?? plan.purpose,
      sourceReviewId: version.sourceReviewId,
      sourceReviewVersion: version.sourceReviewVersion,
      sourceGoalRevisionId: version.sourceGoalRevisionId,
      sourceProfileVersion: version.sourceProfileVersion,
      paths: version.paths.map((path) => ({
        key: path.key,
        clientLabel: path.clientLabel,
        internalLabel: path.internalLabel,
        status: path.status,
        sortOrder: path.sortOrder,
      })),
      items: version.items.map((item) => ({
        stableKey: item.stableKey,
        type: item.type,
        completionMode: item.completionMode,
        owner: item.owner,
        clientTitle: item.clientTitle,
        clientBody: item.clientBody,
        consultantRationale: item.consultantRationale,
        sortOrder: item.sortOrder,
        required: item.required,
        deepLink: item.deepLink,
        ...(item.outcomeSchema
          ? { outcomeSchema: item.outcomeSchema as Prisma.InputJsonValue }
          : {}),
        pathKeys: item.pathMemberships.map(({ path }) => path.key),
      })),
      dependencies: version.items.flatMap((item) =>
        item.prerequisites.map((edge) => ({
          dependentKey: item.stableKey,
          prerequisiteKey: edge.prerequisiteItem.stableKey,
          groupKey: edge.groupKey,
          mode: edge.mode,
        })),
      ),
    };
    assertValid(input);
    for (const item of input.items) {
      if (
        item.completionMode === 'STRUCTURED_OUTCOME' ||
        (item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY' && item.outcomeSchema)
      )
        responseFields(item.outcomeSchema);
    }
    if (version.supersedesVersionId)
      await carryProgress(tx, version.supersedesVersionId, version.id, input);
    if (version.supersedesVersionId)
      await tx.planVersion.update({
        where: { id: version.supersedesVersionId },
        data: { status: 'SUPERSEDED' },
      });
    await tx.planVersion.update({
      where: { id: version.id },
      data: {
        status: 'ACTIVE',
        approvedById: actorId,
        approvedAt: new Date(),
        activatedAt: new Date(),
        optimisticVersion: { increment: 1 },
      },
    });
    await tx.plan.update({
      where: { id: planId },
      data: { status: 'ACTIVE', title: input.title, purpose: input.purpose },
    });
    const reviewedVersions = await tx.planVersion.findMany({
      where: { planId, version: { lte: version.version } },
      select: { id: true },
    });
    await tx.workItem.updateMany({
      where: {
        clientId,
        sourceType: 'PlanVersion',
        sourceId: { in: reviewedVersions.map(({ id }) => id) },
        reasonCode: 'PLAN_RECONCILIATION_REQUIRED',
        authority: 'ATTENTION_PROJECTION',
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      data: { status: 'COMPLETED', completedAt: new Date(), resolvedAt: new Date() },
    });
    const activationItems = await tx.planItem.findMany({ where: { planVersionId: version.id } });
    const completed = new Set(
      activationItems.filter((item) => item.status === 'COMPLETED').map((item) => item.id),
    );
    const dependencies = version.items.flatMap((item) =>
      item.prerequisites.map((edge) => ({
        dependentItemId: item.id,
        prerequisiteItemId: edge.prerequisiteItemId,
        groupKey: edge.groupKey,
        mode: edge.mode,
      })),
    );
    const roots = activationItems.filter(
      (item) =>
        item.status === 'LOCKED' && prerequisitesSatisfied(item.id, dependencies, completed),
    );
    await tx.planItem.updateMany({
      where: { id: { in: roots.map(({ id }) => id) } },
      data: { status: 'AVAILABLE' },
    });
    await tx.auditEvent.create({
      data: {
        clientId,
        actorId,
        action: 'plan.approved',
        entityType: 'PlanVersion',
        entityId: version.id,
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: 'plan.approved',
        eventKey: `plan-approved:${version.id}`,
        aggregateType: 'Plan',
        aggregateId: planId,
        payload: { clientId, domains: ['plan', 'journey', 'home', 'work-queue'] },
      },
    });
    return { planId, versionId: version.id, version: version.version };
  });
}

export async function getPlanSourcePreview(prisma: PrismaClient, clientId: string, planId: string) {
  const plan = await prisma.plan.findFirst({
    where: { id: planId, clientId },
    include: { versions: { include: builderInclude, orderBy: { version: 'desc' }, take: 1 } },
  });
  const latest = plan?.versions[0];
  if (!plan || !latest) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
  return {
    ...(await comparePlanSources(prisma, clientId, latest)),
    expectedVersion: latest.optimisticVersion,
    versionId: latest.id,
    version: latest.version,
    hasPublishedPlan: latest.status !== 'DRAFT' || Boolean(latest.supersedesVersionId),
    keptSteps: latest.items
      .filter((item) => progressStates.includes(item.status))
      .map((item) => ({ title: item.clientTitle, status: item.status })),
  };
}

function versionDraft(
  version: Prisma.PlanVersionGetPayload<{ include: typeof builderInclude }>,
  plan: { title: string; purpose: PlanDraftInput['purpose'] },
): PlanDraftInput {
  return {
    title: version.title ?? plan.title,
    purpose: version.purpose ?? plan.purpose,
    sourceReviewId: version.sourceReviewId,
    sourceReviewVersion: version.sourceReviewVersion,
    sourceGoalRevisionId: version.sourceGoalRevisionId,
    sourceProfileVersion: version.sourceProfileVersion,
    paths: version.paths.map((path) => ({
      key: path.key,
      clientLabel: path.clientLabel,
      internalLabel: path.internalLabel,
      status: path.status,
      sortOrder: path.sortOrder,
    })),
    items: version.items.map((item) => ({
      stableKey: item.stableKey,
      type: item.type,
      completionMode: item.completionMode,
      owner: item.owner,
      clientTitle: item.clientTitle,
      clientBody: item.clientBody,
      consultantRationale: item.consultantRationale,
      required: item.required,
      sortOrder: item.sortOrder,
      deepLink: item.deepLink,
      manuallyProtected: item.manuallyProtected,
      ...(item.outcomeSchema ? { outcomeSchema: item.outcomeSchema as Prisma.InputJsonValue } : {}),
      pathKeys: item.pathMemberships.map(({ path }) => path.key),
    })),
    dependencies: version.items.flatMap((item) =>
      item.prerequisites.map((edge) => ({
        dependentKey: item.stableKey,
        prerequisiteKey: edge.prerequisiteItem.stableKey,
        groupKey: edge.groupKey,
        mode: edge.mode,
      })),
    ),
  };
}

export async function reconcilePlanSources(
  prisma: PrismaClient,
  input: {
    clientId: string;
    planId: string;
    actorId: string;
    expectedVersion: number;
    expectedSourceFingerprint: string;
    reason: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await lockPlan(tx, input.planId);
    const plan = await tx.plan.findFirst({
      where: { id: input.planId, clientId: input.clientId },
      include: { versions: { include: builderInclude, orderBy: { version: 'desc' }, take: 1 } },
    });
    const latest = plan?.versions[0];
    if (!plan || !latest) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
    if (latest.optimisticVersion !== input.expectedVersion)
      throw new AppError(
        'VERSION_CONFLICT',
        409,
        'The Plan changed. Compare sources again before continuing.',
      );
    if (!['DRAFT', 'ACTIVE', 'APPROVED', 'STALE', 'COMPLETED'].includes(latest.status))
      throw new AppError('PLAN_IMMUTABLE', 409, 'This Plan cannot be reconciled.');
    const { sources } = await currentPlanSources(tx, input.clientId);
    const fingerprint = sourceFingerprint(sources);
    if (fingerprint !== input.expectedSourceFingerprint)
      throw new AppError(
        'PLAN_SOURCES_CHANGED',
        409,
        'Source information changed after your preview. Compare sources again.',
      );
    if (fingerprint === sourceFingerprint(latest))
      return { changed: false, planId: plan.id, versionId: latest.id };
    const draft = { ...versionDraft(latest, plan), ...sources };
    const replacement =
      latest.status === 'DRAFT'
        ? await tx.planVersion.update({
            where: { id: latest.id },
            data: {
              ...sources,
              sourceFingerprint: fingerprint,
              optimisticVersion: { increment: 1 },
            },
          })
        : await writeVersion(
            tx,
            plan.id,
            latest.version + 1,
            draft,
            latest.id,
            latest.optimisticVersion + 1,
          );
    const publishedId = latest.status === 'DRAFT' ? latest.supersedesVersionId : latest.id;
    if (publishedId) {
      await tx.planVersion.update({
        where: { id: publishedId },
        data: { status: 'STALE', staleAt: new Date(), staleReason: input.reason },
      });
      await tx.plan.update({ where: { id: plan.id }, data: { status: 'STALE' } });
    }
    await tx.auditEvent.create({
      data: {
        clientId: input.clientId,
        actorId: input.actorId,
        action: 'plan.reconciliation.proposed',
        entityType: 'PlanVersion',
        entityId: replacement.id,
        metadata: {
          previousVersionId: publishedId,
          reason: input.reason,
          sourceFingerprint: fingerprint,
        },
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: 'plan.reconciliation.proposed',
        eventKey: `plan-reconciliation:${replacement.id}:${replacement.optimisticVersion}`,
        aggregateType: 'Plan',
        aggregateId: plan.id,
        payload: { clientId: input.clientId, domains: ['plan', 'journey', 'home', 'work-queue'] },
      },
    });
    const work = {
      clientId: input.clientId,
      title: 'Review Plan source changes',
      domain: 'PLAN' as const,
      authority: 'ATTENTION_PROJECTION' as const,
      sourceType: 'PlanVersion',
      sourceId: replacement.id,
      reasonCode: 'PLAN_RECONCILIATION_REQUIRED',
      dedupeKey: `plan-reconciliation:${replacement.id}`,
      deepLink: { route: `/crm/clients/${input.clientId}/plan` },
      neededSince: new Date(),
    };
    const existingWork = await tx.workItem.findFirst({
      where: { dedupeKey: work.dedupeKey },
      select: { id: true },
    });
    if (existingWork)
      await tx.workItem.update({
        where: { id: existingWork.id },
        data: { neededSince: work.neededSince },
      });
    else await tx.workItem.create({ data: work });
    return {
      changed: true,
      planId: plan.id,
      previousVersionId: publishedId,
      versionId: replacement.id,
      version: replacement.version,
    };
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
    documentIds?: string[];
  },
) {
  const existing = await prisma.planItemOutcome.findFirst({
    where: {
      planItemId: input.itemId,
      idempotencyKey: input.idempotencyKey,
      planItem: { planVersion: { plan: { clientId: input.clientId } } },
    },
  });
  if (existing) return { replayed: true, outcomeId: existing.id };
  try {
    return await prisma.$transaction(async (tx) => {
      await lockItemPlan(tx, input.itemId, input.clientId);
      const item = await tx.planItem.findFirst({
        where: { id: input.itemId, planVersion: { plan: { clientId: input.clientId } } },
        include: {
          planVersion: { include: { plan: true } },
          prerequisites: true,
        },
      });
      if (!item) throw new AppError('NOT_FOUND', 404, 'Plan item was not found');
      const replay = await tx.planItemOutcome.findUnique({
        where: {
          planItemId_idempotencyKey: { planItemId: item.id, idempotencyKey: input.idempotencyKey },
        },
      });
      if (replay) return { replayed: true, outcomeId: replay.id };
      if (item.planVersion.status !== 'ACTIVE' || item.planVersion.plan.status !== 'ACTIVE')
        throw new AppError(
          'PLAN_NOT_ACTIVE',
          409,
          'This Plan is no longer available for new outcomes',
        );
      if (item.owner !== 'CLIENT')
        throw new AppError(
          'PLAN_ITEM_VERIFICATION_REQUIRED',
          403,
          'This step belongs to your consultant or an automated check.',
        );
      if (item.status !== 'AVAILABLE' && item.status !== 'IN_PROGRESS')
        throw new AppError('PLAN_ITEM_LOCKED', 409, 'Complete the required earlier steps first');
      if (
        item.type === 'MILESTONE' ||
        ['CONSULTANT_VERIFY', 'SYSTEM_VERIFY'].includes(item.completionMode)
      )
        throw new AppError(
          'PLAN_ITEM_VERIFICATION_REQUIRED',
          403,
          'This step requires authoritative verification',
        );
      if (
        item.completionMode === 'STRUCTURED_OUTCOME' &&
        input.action === 'COMPLETE' &&
        input.outcome === undefined
      )
        throw new AppError('OUTCOME_REQUIRED', 422, 'A structured outcome is required');

      if (input.action === 'UNABLE' && !input.reason?.trim())
        throw new AppError('REASON_REQUIRED', 422, 'Tell your consultant what you need help with.');
      if (input.action === 'COMPLETE') {
        if (
          item.completionMode === 'STRUCTURED_OUTCOME' ||
          (item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY' && item.outcomeSchema)
        )
          validateResponse(item.outcomeSchema, input.outcome);
        else if (item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY')
          validateResponse(
            {
              type: 'object',
              properties: {
                clientReport: { type: 'string', title: 'What did you complete?', maxLength: 2000 },
              },
              required: ['clientReport'],
            },
            input.outcome,
          );
      }

      const attachments = await preparePlanAttachments(tx, input.clientId, input.documentIds ?? []);
      const outcome = await tx.planItemOutcome.create({
        data: {
          planItemId: item.id,
          idempotencyKey: input.idempotencyKey,
          actorId: input.actorId,
          kind: input.action,
          responseSnapshot: clientResponseForm(item.outcomeSchema, item.completionMode)
            .fields as Prisma.InputJsonValue,
          attachments: { create: attachments },
          ...(input.action === 'UNABLE'
            ? { data: { reason: input.reason!.trim() } }
            : input.outcome === undefined
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
          ...(item.type === 'GUIDANCE' && input.action === 'COMPLETE'
            ? { acknowledgedAt: new Date() }
            : {}),
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
            title:
              nextStatus === 'UNABLE'
                ? `Client needs help: ${item.clientTitle}`
                : `Verify Plan step: ${item.clientTitle}`,
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
      await tx.auditEvent.create({
        data: {
          clientId: input.clientId,
          actorId: input.actorId,
          action: `plan.item.${input.action.toLowerCase()}`,
          entityType: 'PlanItem',
          entityId: item.id,
          correlationId: input.idempotencyKey,
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'plan.item.changed',
          eventKey: `plan-item:${item.id}:${input.idempotencyKey}`,
          aggregateType: 'Plan',
          aggregateId: item.planVersion.planId,
          payload: {
            clientId: input.clientId,
            domains: ['plan', 'home', 'journey', 'credit-center', 'work-queue'],
          },
        },
      });

      if (nextStatus === 'COMPLETED') await unlockCompletedDependencies(tx, item.planVersionId);
      return { replayed: false, outcomeId: outcome.id, status: nextStatus };
    });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
      const replay = await prisma.planItemOutcome.findUniqueOrThrow({
        where: {
          planItemId_idempotencyKey: {
            planItemId: input.itemId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      return { replayed: true, outcomeId: replay.id };
    }
    throw error;
  }
}

export async function verifyPlanItem(
  prisma: PrismaClient,
  clientId: string,
  itemId: string,
  actorId: string,
  review?: {
    decision: 'VERIFY' | 'RETURN' | 'RESUME';
    expectedOutcomeId: string | null;
    note?: string | undefined;
  },
) {
  return prisma.$transaction(async (tx) => {
    await lockItemPlan(tx, itemId, clientId);
    const item = await tx.planItem.findFirst({
      where: {
        id: itemId,
        planVersion: { plan: { clientId, status: 'ACTIVE' }, status: 'ACTIVE' },
      },
      include: { planVersion: true },
    });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Plan item was not found');
    const evidence = await itemHistory(
      tx,
      item.planVersion.planId,
      item.planVersion.version,
      item.stableKey,
    );
    if (review && review.expectedOutcomeId !== evidence.latestOutcomeId)
      throw new AppError(
        'PLAN_EVIDENCE_CHANGED',
        409,
        'The submitted evidence changed. Reload before reviewing it.',
      );
    const returning = review?.decision === 'RETURN';
    const resuming = review?.decision === 'RESUME';
    const reopen = returning || resuming;
    if (resuming && (item.status !== 'UNABLE' || item.owner !== 'CLIENT' || !review.note?.trim()))
      throw new AppError(
        'PLAN_HELP_INVALID',
        422,
        'Explain how the client can continue before reopening a step that needs help.',
      );
    if (!reopen && evidence.latestOutcomeId) {
      await tx.$queryRaw(
        Prisma.sql`SELECT d."id" FROM "Document" d INNER JOIN "PlanOutcomeAttachment" a ON a."documentId" = d."id" WHERE a."outcomeId" = ${evidence.latestOutcomeId}::uuid ORDER BY d."id" FOR SHARE OF d`,
      );
      const attachments = await tx.planOutcomeAttachment.findMany({
        where: { outcomeId: evidence.latestOutcomeId },
        include: { document: true },
      });
      if (
        attachments.some(
          (row) =>
            row.document.status === 'DELETED' ||
            !row.document.clientVisible ||
            row.document.sha256 !== row.sha256,
        )
      )
        throw new AppError(
          'PLAN_EVIDENCE_UNAVAILABLE',
          409,
          'An attached file is no longer available for review. Request a correction and ask the client to attach an available file.',
        );
    }
    if (returning && (!review.note?.trim() || item.status !== 'AWAITING_VERIFICATION'))
      throw new AppError(
        'PLAN_CORRECTION_INVALID',
        422,
        'Explain what the client should correct on the submitted response.',
      );
    if (
      !resuming &&
      (!(item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY'
        ? item.status === 'AWAITING_VERIFICATION'
        : item.status === 'AVAILABLE') ||
        !['CLIENT_REPORT_CONSULTANT_VERIFY', 'CONSULTANT_VERIFY'].includes(item.completionMode))
    )
      throw new AppError(
        'INVALID_PLAN_ITEM_STATE',
        409,
        'This item is not awaiting consultant verification',
      );
    await tx.planItem.update({
      where: { id: item.id },
      data: {
        status: reopen ? 'IN_PROGRESS' : 'COMPLETED',
        completedAt: reopen ? null : new Date(),
      },
    });
    const decision = await tx.planItemOutcome.create({
      data: {
        planItemId: item.id,
        actorId,
        idempotencyKey: `review:${evidence.latestOutcomeId ?? 'initial'}`,
        kind: resuming ? 'HELP_RESOLVED' : returning ? 'CORRECTION_REQUESTED' : 'VERIFIED',
        data: { note: review?.note?.trim() ?? '' },
      },
    });
    if (!reopen) await unlockCompletedDependencies(tx, item.planVersionId);
    await tx.workItem.updateMany({
      where: { sourceType: 'PlanItem', sourceId: item.id, status: { not: 'COMPLETED' } },
      data: { status: 'COMPLETED', completedAt: new Date(), resolvedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        clientId,
        actorId,
        action: resuming
          ? 'plan.item.help_resolved'
          : returning
            ? 'plan.item.correction_requested'
            : 'plan.item.verified',
        entityType: 'PlanItem',
        entityId: item.id,
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: reopen ? 'plan.item.changed' : 'plan.item.verified',
        eventKey: `plan-item-reviewed:${decision.id}`,
        aggregateType: 'Plan',
        aggregateId: item.planVersion.planId,
        payload: { clientId, domains: ['plan', 'home', 'journey', 'work-queue'] },
      },
    });
    return {
      itemId: item.id,
      status: reopen ? ('IN_PROGRESS' as const) : ('COMPLETED' as const),
    };
  });
}

async function unlockCompletedDependencies(tx: Prisma.TransactionClient, versionId: string) {
  const versionItems = await tx.planItem.findMany({
    where: { planVersionId: versionId },
    include: { prerequisites: true },
  });
  const completed = new Set(
    versionItems.filter(({ status }) => status === 'COMPLETED').map(({ id }) => id),
  );
  const dependencies = versionItems.flatMap((candidate) =>
    candidate.prerequisites.map((edge) => ({
      dependentItemId: candidate.id,
      prerequisiteItemId: edge.prerequisiteItemId,
      groupKey: edge.groupKey,
      mode: edge.mode,
    })),
  );
  const unlockIds = versionItems
    .filter(
      (candidate) =>
        candidate.status === 'LOCKED' &&
        prerequisitesSatisfied(candidate.id, dependencies, completed),
    )
    .map(({ id }) => id);
  if (unlockIds.length)
    await tx.planItem.updateMany({
      where: { id: { in: unlockIds } },
      data: { status: 'AVAILABLE' },
    });
}

async function itemHistory(
  tx: Prisma.TransactionClient,
  planId: string,
  version: number,
  stableKey: string,
) {
  const rows = await tx.planItemOutcome.findMany({
    where: {
      planItem: {
        stableKey,
        planVersion: { planId, version: { lte: version }, status: { not: 'DRAFT' } },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 21,
    select: {
      id: true,
      kind: true,
      data: true,
      createdAt: true,
      responseSnapshot: true,
      attachments: {
        select: {
          documentId: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          document: { select: { status: true, clientVisible: true, sha256: true } },
        },
      },
    },
  });
  return {
    latestOutcomeId: rows[0]?.id ?? null,
    history: rows
      .slice(0, 20)
      .reverse()
      .map(({ attachments, ...entry }) => ({
        ...entry,
        attachments: attachments.map(({ document, ...file }) => ({
          ...file,
          available:
            document.clientVisible &&
            document.status !== 'DELETED' &&
            document.sha256 === file.sha256,
          status: document.status,
        })),
      })),
    historyLimited: rows.length > 20,
  };
}
