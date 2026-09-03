import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (value: unknown) => value as Prisma.InputJsonValue;
export const restrictionScopes = ['CYCLE', 'STRATEGY', 'SCHEDULING', 'LIVE_EXECUTION'] as const;

export async function assertNoCreditActivityRestriction(
  prisma: PrismaClient | Prisma.TransactionClient,
  clientId: string,
  scope: (typeof restrictionScopes)[number],
) {
  const restriction = await prisma.clientCreditActivityRestriction.findFirst({
    where: { clientId, scope, clearedAt: null },
    orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }],
  });
  if (restriction)
    throw new AppError(
      'CREDIT_ACTIVITY_RESTRICTED',
      409,
      'Major Credit Readiness coordination currently pauses this card activity',
    );
}

async function context(prisma: PrismaClient | Prisma.TransactionClient, clientId: string) {
  const [profile, entitlement, precheck] = await Promise.all([
    prisma.creditProfileState.findUnique({ where: { clientId } }),
    prisma.serviceEntitlement.findFirst({
      where: {
        clientId,
        serviceType: 'MAJOR_APPLICATION_READINESS',
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.roundMajorApplicationCheck.findFirst({
      where: { clientId, choice: { not: 'NO' } },
      orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
    }),
  ]);
  return { profile, entitlement, precheck };
}

export async function getCase(
  prisma: PrismaClient,
  clientId: string,
  caseId?: string,
  includeDraft = false,
) {
  const item = await prisma.majorReadinessCase.findFirst({
    where: { clientId, ...(caseId ? { id: caseId } : { status: { not: 'COMPLETE' } }) },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    include: {
      recommendations: { orderBy: { version: 'desc' } },
      decisions: { orderBy: { version: 'desc' } },
      restrictions: { orderBy: [{ effectiveAt: 'desc' }, { id: 'asc' }] },
      events: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
    },
  });
  if (caseId && !item)
    throw new AppError('MAJOR_READINESS_CASE_NOT_FOUND', 404, 'Major Readiness case was not found');
  if (!item) return { case: null };
  const approved = item.recommendations.find((r) => r.approvedAt && !r.supersededAt);
  const recommendation =
    approved ?? (includeDraft ? item.recommendations.find((r) => !r.supersededAt) : undefined);
  return {
    case: {
      id: item.id,
      clientId: item.clientId,
      intentType: item.intentType,
      targetTiming: item.targetTiming,
      clientContext: item.clientContext,
      status: item.status,
      version: item.version,
      profileStateId: item.profileStateId,
      sourceReviewId: item.sourceReviewId,
      preparationPlanId: item.preparationPlanId,
      finalizedAt: item.finalizedAt,
      recommendation: recommendation
        ? {
            id: recommendation.id,
            version: recommendation.version,
            type: recommendation.type,
            clientSafeExplanation: recommendation.clientSafeExplanation,
            approvedAt: recommendation.approvedAt,
          }
        : null,
      decision: item.decisions.find((d) => !d.supersededAt)
        ? ((d) => ({
            id: d.id,
            version: d.version,
            type: d.type,
            clientSafeExplanation: d.clientSafeExplanation,
            effectiveAt: d.effectiveAt,
          }))(item.decisions.find((d) => !d.supersededAt)!)
        : null,
      restrictions: item.restrictions.map((r) => ({
        id: r.id,
        scope: r.scope,
        effectiveAt: r.effectiveAt,
        clearedAt: r.clearedAt,
        clearReason: r.clearReason,
      })),
      timeline: item.events.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
    },
  };
}

export async function startCase(
  prisma: PrismaClient,
  input: {
    clientId: string;
    actorId: string;
    intentType?: string | undefined;
    targetTiming?: string | undefined;
    clientContext?: string | undefined;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.clientId,
      operation: 'start',
      key: input.idempotencyKey,
      requestHash: hash(input),
    },
    audit: (r: { caseId: string }) => ({
      action: 'MAJOR_READINESS_STARTED',
      entityType: 'MajorReadinessCase',
      entityId: r.caseId,
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'major-readiness.changed',
      eventKey: `major-readiness:${input.clientId}:start:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: (r: { caseId: string }) => r.caseId,
      payload: (r: { caseId: string }) => ({
        clientId: input.clientId,
        caseId: r.caseId,
        domains: ['major-readiness', 'work-queue'],
      }),
    },
    mutate: async (tx) => {
      const existing = await tx.majorReadinessCase.findFirst({
        where: { clientId: input.clientId, status: { not: 'COMPLETE' } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      });
      if (existing) return { caseId: existing.id, existing: true };
      const source = await context(tx, input.clientId);
      if (!source.profile || source.profile.status !== 'CURRENT')
        throw new AppError(
          'CURRENT_PROFILE_REQUIRED',
          409,
          'A current Credit Profile Review is required',
        );
      if (!source.entitlement)
        throw new AppError(
          'MAJOR_READINESS_ENTITLEMENT_REQUIRED',
          409,
          'Major Credit Readiness service access is required',
        );
      const created = await tx.majorReadinessCase.create({
        data: {
          clientId: input.clientId,
          intentType: input.intentType ?? source.precheck?.choice ?? 'NOT_SURE',
          targetTiming: input.targetTiming ?? source.precheck?.intendedTiming ?? null,
          clientContext: input.clientContext ?? source.precheck?.clientContext ?? null,
          profileStateId: source.profile.id,
          sourceReviewId: source.profile.sourceReviewId,
          serviceEntitlementId: source.entitlement.id,
          sourceMajorCheckId: source.precheck?.id ?? null,
          createdByUserId: input.actorId,
        },
      });
      await tx.majorReadinessEvent.create({
        data: {
          caseId: created.id,
          clientId: input.clientId,
          actorUserId: input.actorId,
          type: 'CASE_STARTED',
          payload: json({ reusedPrecheck: Boolean(source.precheck) }),
        },
      });
      const workKey = `major-readiness:${created.id}:assessment`;
      const work = await tx.workItem.findFirst({
        where: { dedupeKey: workKey, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } },
      });
      if (!work)
        await tx.workItem.create({
          data: {
            clientId: input.clientId,
            title: 'Assess major credit readiness',
            domain: 'MAJOR_READINESS',
            priority: 'HIGH',
            sourceType: 'MajorReadinessCase',
            sourceId: created.id,
            dedupeKey: workKey,
            reasonCode: 'PROFESSIONAL_REVIEW_REQUIRED',
            suggestedNextAction: 'Review application timing and current profile',
            deepLink: { path: `/crm/clients/${input.clientId}/major-readiness/${created.id}` },
          },
        });
      return { caseId: created.id, existing: false };
    },
  });
}

export async function updateCase(
  prisma: PrismaClient,
  input: {
    caseId: string;
    clientId: string;
    actorId: string;
    expectedVersion: number;
    intentType: string;
    targetTiming?: string | undefined;
    clientContext?: string | undefined;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'update',
      key: input.idempotencyKey,
      requestHash: hash(input),
    },
    audit: {
      action: 'MAJOR_READINESS_DETAILS_UPDATED',
      entityType: 'MajorReadinessCase',
      entityId: input.caseId,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'major-readiness.changed',
      eventKey: `major-readiness:${input.caseId}:update:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: { clientId: input.clientId, caseId: input.caseId },
    },
    mutate: async (tx) => {
      const changed = await tx.majorReadinessCase.updateMany({
        where: {
          id: input.caseId,
          clientId: input.clientId,
          version: input.expectedVersion,
          status: { not: 'COMPLETE' },
        },
        data: {
          intentType: input.intentType,
          targetTiming: input.targetTiming ?? null,
          clientContext: input.clientContext ?? null,
          version: { increment: 1 },
          status: 'REASSESSMENT',
        },
      });
      if (changed.count !== 1)
        throw new AppError(
          'STALE_MAJOR_READINESS_CASE',
          409,
          'Case changed; refresh before saving',
        );
      await tx.majorReadinessRecommendation.updateMany({
        where: { caseId: input.caseId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.coordinationDecision.updateMany({
        where: { caseId: input.caseId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.majorReadinessEvent.create({
        data: {
          caseId: input.caseId,
          clientId: input.clientId,
          actorUserId: input.actorId,
          type: 'DETAILS_CHANGED_REASSESSMENT_REQUIRED',
          payload: json({ intentType: input.intentType, targetTiming: input.targetTiming }),
        },
      });
      return { caseId: input.caseId };
    },
  });
}

export async function draftRecommendation(
  prisma: PrismaClient,
  input: {
    caseId: string;
    clientId: string;
    actorId: string;
    type: 'PROCEED_NOW' | 'PREPARE_FIRST' | 'REASSESS_LATER';
    clientSafeExplanation: string;
    internalRationale?: string | undefined;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'draft-recommendation',
      key: input.idempotencyKey,
      requestHash: hash(input),
    },
    audit: (r: { recommendationId: string }) => ({
      action: 'MAJOR_READINESS_RECOMMENDATION_DRAFTED',
      entityType: 'MajorReadinessRecommendation',
      entityId: r.recommendationId,
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'major-readiness.changed',
      eventKey: `major-readiness:${input.caseId}:recommendation:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: { clientId: input.clientId, caseId: input.caseId },
    },
    mutate: async (tx) => {
      const c = await tx.majorReadinessCase.findFirst({
        where: { id: input.caseId, clientId: input.clientId, status: { not: 'COMPLETE' } },
      });
      if (!c) throw new AppError('MAJOR_READINESS_CASE_NOT_FOUND', 404, 'Case not found');
      const source = await context(tx, input.clientId);
      if (
        !source.profile ||
        source.profile.id !== c.profileStateId ||
        source.profile.status !== 'CURRENT'
      )
        throw new AppError(
          'STALE_MAJOR_READINESS_SOURCE',
          409,
          'Current profile changed; reassessment is required',
        );
      const latest = await tx.majorReadinessRecommendation.findFirst({
        where: { caseId: c.id },
        orderBy: { version: 'desc' },
      });
      const snapshot = {
        profileStateId: c.profileStateId,
        sourceReviewId: c.sourceReviewId,
        intentType: c.intentType,
        targetTiming: c.targetTiming,
        caseVersion: c.version,
      };
      const r = await tx.majorReadinessRecommendation.create({
        data: {
          caseId: c.id,
          version: (latest?.version ?? 0) + 1,
          type: input.type,
          clientSafeExplanation: input.clientSafeExplanation,
          internalRationale: input.internalRationale ?? null,
          sourceFingerprint: hash(snapshot),
          sourceSnapshot: json(snapshot),
        },
      });
      return { recommendationId: r.id, version: r.version };
    },
  });
}

export async function approveRecommendation(
  prisma: PrismaClient,
  input: {
    recommendationId: string;
    caseId: string;
    clientId: string;
    actorId: string;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'approve-recommendation',
      key: input.idempotencyKey,
    },
    audit: {
      action: 'MAJOR_READINESS_RECOMMENDATION_APPROVED',
      entityType: 'MajorReadinessRecommendation',
      entityId: input.recommendationId,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'major-readiness.changed',
      eventKey: `major-readiness:${input.caseId}:approved:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: { clientId: input.clientId, caseId: input.caseId },
    },
    mutate: async (tx) => {
      const r = await tx.majorReadinessRecommendation.findFirst({
        where: {
          id: input.recommendationId,
          caseId: input.caseId,
          approvedAt: null,
          supersededAt: null,
        },
        include: { case: true },
      });
      if (!r || r.case.clientId !== input.clientId)
        throw new AppError('RECOMMENDATION_NOT_CURRENT', 409, 'Recommendation is not current');
      await tx.majorReadinessRecommendation.updateMany({
        where: { caseId: input.caseId, approvedAt: { not: null }, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.majorReadinessRecommendation.update({
        where: { id: r.id },
        data: { approvedAt: new Date(), approvedByUserId: input.actorId },
      });
      let plan = await tx.plan.findFirst({
        where: {
          clientId: input.clientId,
          purpose: 'PREPARATION',
          status: { in: ['DRAFT', 'APPROVED', 'ACTIVE'] },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      });
      if (!plan)
        plan = await tx.plan.create({
          data: {
            clientId: input.clientId,
            purpose: 'PREPARATION',
            status: 'ACTIVE',
            title: 'Major credit readiness preparation',
          },
        });
      const pv =
        (await tx.planVersion.findFirst({
          where: { planId: plan.id },
          orderBy: { version: 'desc' },
        })) ??
        (await tx.planVersion.create({
          data: {
            planId: plan.id,
            version: 1,
            status: 'ACTIVE',
            sourceFingerprint: r.sourceFingerprint,
            approvedById: input.actorId,
            approvedAt: new Date(),
            activatedAt: new Date(),
          },
        }));
      await tx.planItem.upsert({
        where: {
          planVersionId_stableKey: {
            planVersionId: pv.id,
            stableKey: `major-readiness:${input.caseId}:prepare`,
          },
        },
        create: {
          planVersionId: pv.id,
          stableKey: `major-readiness:${input.caseId}:prepare`,
          type: 'ACTION',
          completionMode: 'ACKNOWLEDGEMENT',
          status: 'AVAILABLE',
          owner: 'CLIENT',
          clientTitle: 'Complete major credit preparation',
          clientBody: r.clientSafeExplanation,
          deepLink: '/app/major-readiness/preparation',
        },
        update: { clientBody: r.clientSafeExplanation },
      });
      await tx.majorReadinessCase.update({
        where: { id: input.caseId },
        data: { currentRecommendationId: r.id, preparationPlanId: plan.id, status: 'PREPARATION' },
      });
      return { recommendationId: r.id, planId: plan.id };
    },
  });
}

export async function approveDecision(
  prisma: PrismaClient,
  input: {
    caseId: string;
    clientId: string;
    actorId: string;
    type: 'NO_RESTRICTION' | 'PAUSE_CARD_ACTIVITY' | 'LIMIT_CARD_ACTIVITY';
    clientSafeExplanation: string;
    internalRationale?: string | undefined;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'coordination-decision',
      key: input.idempotencyKey,
      requestHash: hash(input),
    },
    audit: (r: { decisionId: string }) => ({
      action: 'COORDINATION_DECISION_APPROVED',
      entityType: 'CoordinationDecision',
      entityId: r.decisionId,
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'credit-activity-restriction.changed',
      eventKey: `major-readiness:${input.caseId}:decision:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: {
        clientId: input.clientId,
        caseId: input.caseId,
        domains: ['application-cycles', 'strategy', 'appointments', 'live-sessions', 'work-queue'],
      },
    },
    mutate: async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`major-decision:${input.caseId}`})) IS NULL AS acquired`,
      );
      const c = await tx.majorReadinessCase.findFirst({
        where: { id: input.caseId, clientId: input.clientId, status: { not: 'COMPLETE' } },
      });
      if (!c?.currentRecommendationId)
        throw new AppError(
          'APPROVED_RECOMMENDATION_REQUIRED',
          409,
          'Approve a current recommendation first',
        );
      const recommendation = await tx.majorReadinessRecommendation.findFirst({
        where: { id: c.currentRecommendationId, approvedAt: { not: null }, supersededAt: null },
      });
      if (!recommendation)
        throw new AppError('STALE_RECOMMENDATION', 409, 'Recommendation is stale');
      const latest = await tx.coordinationDecision.findFirst({
        where: { caseId: c.id },
        orderBy: { version: 'desc' },
      });
      await tx.coordinationDecision.updateMany({
        where: { caseId: c.id, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      await tx.clientCreditActivityRestriction.updateMany({
        where: { caseId: c.id, clearedAt: null },
        data: {
          clearedAt: new Date(),
          clearedByUserId: input.actorId,
          clearReason: 'Superseded by a new coordination decision',
        },
      });
      const d = await tx.coordinationDecision.create({
        data: {
          caseId: c.id,
          version: (latest?.version ?? 0) + 1,
          type: input.type,
          clientSafeExplanation: input.clientSafeExplanation,
          internalRationale: input.internalRationale ?? null,
          sourceRecommendationId: recommendation.id,
          decidedByUserId: input.actorId,
        },
      });
      if (input.type !== 'NO_RESTRICTION')
        await tx.clientCreditActivityRestriction.createMany({
          data: restrictionScopes.map((scope) => ({
            clientId: input.clientId,
            caseId: c.id,
            decisionId: d.id,
            scope,
            reasonCode: input.type,
          })),
        });
      await tx.majorReadinessCase.update({
        where: { id: c.id },
        data: { currentDecisionId: d.id, status: 'COORDINATION', version: { increment: 1 } },
      });
      await tx.majorReadinessEvent.create({
        data: {
          caseId: c.id,
          clientId: input.clientId,
          actorUserId: input.actorId,
          type: 'COORDINATION_DECISION_APPROVED',
          payload: json({ decisionId: d.id, type: input.type }),
        },
      });
      return {
        decisionId: d.id,
        restrictionCount: input.type === 'NO_RESTRICTION' ? 0 : restrictionScopes.length,
      };
    },
  });
}

export async function clearRestrictions(
  prisma: PrismaClient,
  input: {
    caseId: string;
    clientId: string;
    actorId: string;
    reason: string;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'clear-restrictions',
      key: input.idempotencyKey,
    },
    audit: {
      action: 'CREDIT_ACTIVITY_RESTRICTIONS_CLEARED',
      entityType: 'MajorReadinessCase',
      entityId: input.caseId,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'credit-activity-restriction.changed',
      eventKey: `major-readiness:${input.caseId}:clear:${input.idempotencyKey}`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: { clientId: input.clientId, caseId: input.caseId, revalidate: true },
    },
    mutate: async (tx) => {
      const c = await tx.majorReadinessCase.findFirst({
        where: { id: input.caseId, clientId: input.clientId },
      });
      if (!c) throw new AppError('MAJOR_READINESS_CASE_NOT_FOUND', 404, 'Case not found');
      const result = await tx.clientCreditActivityRestriction.updateMany({
        where: { caseId: c.id, clearedAt: null },
        data: { clearedAt: new Date(), clearedByUserId: input.actorId, clearReason: input.reason },
      });
      await tx.roundStrategy.updateMany({
        where: { clientId: input.clientId, status: { in: ['DRAFT', 'APPROVED'] } },
        data: { status: 'STALE' },
      });
      await tx.majorReadinessEvent.create({
        data: {
          caseId: c.id,
          clientId: input.clientId,
          actorUserId: input.actorId,
          type: 'RESTRICTIONS_CLEARED_REVALIDATION_REQUIRED',
          payload: json({ reason: input.reason, count: result.count }),
        },
      });
      return { cleared: result.count, revalidationRequired: true };
    },
  });
}

export async function finalizeCase(
  prisma: PrismaClient,
  input: { caseId: string; clientId: string; actorId: string; idempotencyKey: string },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'major-readiness',
      subjectId: input.caseId,
      operation: 'finalize',
      key: input.idempotencyKey,
    },
    audit: {
      action: 'MAJOR_READINESS_FINALIZED',
      entityType: 'MajorReadinessCase',
      entityId: input.caseId,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'major-readiness.changed',
      eventKey: `major-readiness:${input.caseId}:finalized`,
      aggregateType: 'MajorReadinessCase',
      aggregateId: input.caseId,
      payload: { clientId: input.clientId, caseId: input.caseId },
    },
    mutate: async (tx) => {
      const active = await tx.clientCreditActivityRestriction.count({
        where: { caseId: input.caseId, clearedAt: null },
      });
      if (active)
        throw new AppError(
          'ACTIVE_RESTRICTION_REMAINS',
          409,
          'Clear active restrictions before finalizing',
        );
      const changed = await tx.majorReadinessCase.updateMany({
        where: { id: input.caseId, clientId: input.clientId, status: { not: 'COMPLETE' } },
        data: { status: 'COMPLETE', finalizedAt: new Date(), version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new AppError('CASE_NOT_FINALIZABLE', 409, 'Case cannot be finalized');
      await tx.majorReadinessEvent.create({
        data: {
          caseId: input.caseId,
          clientId: input.clientId,
          actorUserId: input.actorId,
          type: 'CASE_FINALIZED',
          payload: json({ reentryRequiresCurrentChecks: true }),
        },
      });
      await tx.workItem.updateMany({
        where: {
          clientId: input.clientId,
          sourceType: 'MajorReadinessCase',
          sourceId: input.caseId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
        },
        data: { status: 'COMPLETED', completedAt: new Date(), resolvedAt: new Date() },
      });
      return { caseId: input.caseId, status: 'COMPLETE', reentryRequiresCurrentChecks: true };
    },
  });
}
