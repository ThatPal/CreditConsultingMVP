import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import type { DurableAIRuntime } from '../ai/durableRuntime.js';
import { AIProviderError } from '../ai/runtime.js';
import { registerStrategyProcess, STRATEGY_PREPARE_PROCESS } from './ai.js';
import { assertNoCreditActivityRestriction } from '../majorReadiness/service.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function strategySource(
  prisma: PrismaClient | Prisma.TransactionClient,
  roundId: string,
  clientId: string,
) {
  const round = await prisma.creditCardRound.findFirst({
    where: { id: roundId, clientId },
    include: {
      goalSnapshot: true,
      preparationPlanVersion: {
        include: {
          items: {
            select: { id: true, required: true, status: true, updatedAt: true },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
      },
      serviceEntitlement: true,
      majorApplicationChecks: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  const [profile, review, cards, wishlist, applications] = await Promise.all([
    prisma.creditProfileState.findUnique({ where: { clientId } }),
    round.sourceReviewId
      ? prisma.creditReview.findUnique({ where: { id: round.sourceReviewId } })
      : null,
    prisma.clientCard.findMany({
      where: { clientId },
      select: {
        id: true,
        updatedAt: true,
        cardProductId: true,
        cardProduct: {
          select: {
            currentOfferVersion: { select: { id: true, status: true, freshUntil: true } },
            currentInsightVersion: { select: { id: true, status: true, staleAt: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.clientCardWishlist.findMany({
      where: { clientId },
      select: { productId: true, updatedAt: true },
      orderBy: { productId: 'asc' },
    }),
    prisma.cycleApplication.findMany({
      where: { cycleId: round.cycleId },
      select: { id: true, outcome: true, submittedAt: true },
      orderBy: { id: 'asc' },
    }),
  ]);
  const context = {
    roundId: round.id,
    roundFingerprint: round.sourceFingerprint,
    goal: { id: round.goalSnapshot.sourceGoalId, version: round.goalSnapshot.sourceGoalVersion },
    profile: profile
      ? { id: profile.id, updatedAt: profile.updatedAt.toISOString(), status: profile.status }
      : null,
    review: review
      ? { id: review.id, updatedAt: review.updatedAt.toISOString(), status: review.status }
      : null,
    plan: round.preparationPlanVersion
      ? {
          id: round.preparationPlanVersion.id,
          version: round.preparationPlanVersion.version,
          sourceFingerprint: round.preparationPlanVersion.sourceFingerprint,
          status: round.preparationPlanVersion.status,
          updatedAt: round.preparationPlanVersion.updatedAt.toISOString(),
          requiredItems: round.preparationPlanVersion.items
            .filter((item) => item.required)
            .map((item) => ({
              id: item.id,
              status: item.status,
              updatedAt: item.updatedAt.toISOString(),
            })),
        }
      : null,
    entitlement: {
      id: round.serviceEntitlement.id,
      status: round.serviceEntitlement.status,
      quantityUsed: round.serviceEntitlement.quantityUsed,
      updatedAt: round.serviceEntitlement.updatedAt.toISOString(),
    },
    clientCards: cards.map((card) => ({
      id: card.id,
      updatedAt: card.updatedAt.toISOString(),
      productId: card.cardProductId,
      offer: card.cardProduct?.currentOfferVersion
        ? {
            id: card.cardProduct.currentOfferVersion.id,
            status: card.cardProduct.currentOfferVersion.status,
            freshUntil: card.cardProduct.currentOfferVersion.freshUntil?.toISOString() ?? null,
          }
        : null,
      insight: card.cardProduct?.currentInsightVersion
        ? {
            id: card.cardProduct.currentInsightVersion.id,
            status: card.cardProduct.currentInsightVersion.status,
            staleAt: card.cardProduct.currentInsightVersion.staleAt?.toISOString() ?? null,
          }
        : null,
    })),
    wishlist: wishlist.map((item) => ({
      productId: item.productId,
      updatedAt: item.updatedAt.toISOString(),
    })),
    priorApplications: applications.map((application) => ({
      ...application,
      submittedAt: application.submittedAt.toISOString(),
    })),
    majorCheck: round.majorApplicationChecks[0]
      ? { id: round.majorApplicationChecks[0].id, version: round.majorApplicationChecks[0].version }
      : null,
  };
  return { round, context, fingerprint: hash(context) };
}

export async function createStrategyDraft(
  prisma: PrismaClient,
  input: { roundId: string; clientId: string; actorId: string },
  runtime?: DurableAIRuntime,
) {
  await assertNoCreditActivityRestriction(prisma, input.clientId, 'STRATEGY');
  const source = await strategySource(prisma, input.roundId, input.clientId);
  const strategy = await prisma.roundStrategy.upsert({
    where: { roundId: input.roundId },
    create: { roundId: input.roundId, clientId: input.clientId },
    update: {},
  });
  const latest = await prisma.strategyVersion.findFirst({
    where: { strategyId: strategy.id },
    orderBy: { version: 'desc' },
  });
  if (
    latest &&
    ['DRAFT', 'READY_FOR_APPROVAL'].includes(latest.status) &&
    latest.sourceFingerprint === source.fingerprint
  )
    return strategyProjection(prisma, strategy.id, input.clientId, false);
  const version = await prisma.strategyVersion.create({
    data: {
      strategyId: strategy.id,
      version: (latest?.version ?? 0) + 1,
      sourceFingerprint: source.fingerprint,
      sourceContext: json(source.context),
      createdByUserId: input.actorId,
      brief: json({
        authority: 'PROPOSAL_ONLY',
        status: runtime ? 'AI_PREPARATION_QUEUED' : 'MANUAL_FALLBACK',
        currentContext: source.context,
        manualFallbackAvailable: true,
      }),
      rules: json([]),
    },
  });
  if (runtime) {
    try {
      await registerStrategyProcess(runtime);
      const job = await runtime.createAndEnqueue({
        processKey: STRATEGY_PREPARE_PROCESS,
        processVersion: 1,
        clientId: input.clientId,
        correlationId: `strategy:${strategy.id}:v${version.version}`,
        relatedEntityType: 'StrategyVersion',
        relatedEntityId: version.id,
        sourceIdentity: source.fingerprint,
        sourceVersions: { strategy: source.fingerprint, round: source.round.sourceFingerprint },
        input: { context: source.context },
      });
      await prisma.strategyVersion.update({ where: { id: version.id }, data: { aiJobId: job.id } });
    } catch (error) {
      if (!(error instanceof AIProviderError)) throw error;
      await prisma.strategyVersion.update({
        where: { id: version.id },
        data: {
          brief: json({
            authority: 'PROPOSAL_ONLY',
            status: 'AI_UNAVAILABLE',
            failureCode: error.code,
            currentContext: source.context,
            manualFallbackAvailable: true,
          }),
        },
      });
    }
  }
  return strategyProjection(prisma, strategy.id, input.clientId, false);
}

async function attachCompletedStrategyOutput(prisma: PrismaClient, strategyId: string) {
  const pending = await prisma.strategyVersion.findMany({
    where: { strategyId, aiJobId: { not: null }, aiJobOutputId: null },
    select: { id: true, aiJobId: true },
  });
  for (const version of pending) {
    const output = await prisma.aIJobOutput.findFirst({
      where: { jobId: version.aiJobId!, staleAt: null, status: 'VALIDATED' },
      orderBy: { outputVersion: 'desc' },
    });
    if (output)
      await prisma.strategyVersion.update({
        where: { id: version.id },
        data: {
          aiJobOutputId: output.id,
          aiProposal: json(output.result),
          brief: json({
            authority: 'PROPOSAL_ONLY',
            status: 'AI_PREPARED',
            proposal: output.result,
            provenance: output.provenance,
            confidence: output.confidence,
            manualFallbackAvailable: true,
          }),
        },
      });
  }
}

export async function strategyProjection(
  prisma: PrismaClient,
  strategyId: string,
  clientId: string,
  clientSafe: boolean,
) {
  await attachCompletedStrategyOutput(prisma, strategyId);
  const strategy = await prisma.roundStrategy.findFirst({
    where: { id: strategyId, clientId },
    include: {
      versions: { include: { candidates: true, applications: true }, orderBy: { version: 'desc' } },
    },
  });
  if (!strategy) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  const current = strategy.versions[0] ?? null;
  const approved = strategy.approvedVersionId
    ? (strategy.versions.find((version) => version.id === strategy.approvedVersionId) ?? null)
    : null;
  if (clientSafe) {
    if (!approved)
      return {
        strategy: { id: strategy.id, roundId: strategy.roundId, status: strategy.status },
        approved: null,
      };
    if (strategy.status === 'STALE')
      return {
        strategy: { id: strategy.id, roundId: strategy.roundId, status: strategy.status },
        approved: null,
        stale: true,
        historical: { version: approved.version, approvedAt: approved.approvedAt },
      };
    return {
      strategy: { id: strategy.id, roundId: strategy.roundId, status: strategy.status },
      approved: {
        id: approved.id,
        version: approved.version,
        approvedAt: approved.approvedAt,
        cards: approved.candidates
          .filter((candidate) => candidate.disposition === 'SHORTLISTED')
          .map((candidate) => ({
            productId: candidate.productId,
            role: candidate.role,
            reason: candidate.clientSafeReason,
          })),
        sequence: approved.applications.map((item) => ({
          sequence: item.sequence,
          role: item.role,
          reason: item.clientSafeReason,
        })),
      },
    };
  }
  return { strategy, current, approved };
}

export async function getRoundStrategy(
  prisma: PrismaClient,
  roundId: string,
  clientId: string,
  clientSafe = false,
) {
  const strategy = await prisma.roundStrategy.findFirst({ where: { roundId, clientId } });
  if (!strategy) return { strategy: null, approved: null };
  const source = await strategySource(prisma, roundId, clientId);
  const current = await prisma.strategyVersion.findFirst({
    where: { strategyId: strategy.id },
    orderBy: { version: 'desc' },
  });
  if (
    current &&
    current.sourceFingerprint !== source.fingerprint &&
    current.status !== 'SUPERSEDED' &&
    current.status !== 'STALE'
  ) {
    await prisma.$transaction([
      prisma.strategyVersion.update({
        where: { id: current.id },
        data: { status: 'STALE', staleAt: new Date() },
      }),
      prisma.roundStrategy.update({
        where: { id: strategy.id },
        data: { status: 'STALE', version: { increment: 1 } },
      }),
    ]);
  }
  return strategyProjection(prisma, strategy.id, clientId, clientSafe);
}

export async function strategyCatalog(prisma: PrismaClient, search?: string) {
  const products = await prisma.cardProduct.findMany({
    where: {
      lifecycle: 'ACTIVE',
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { issuer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      displayName: true,
      audience: true,
      portfolioType: true,
      secured: true,
      features: true,
      tags: true,
      issuer: { select: { id: true, name: true } },
      currentOfferVersion: {
        select: {
          id: true,
          version: true,
          status: true,
          facts: true,
          freshUntil: true,
          staleAt: true,
        },
      },
      currentInsightVersion: {
        select: {
          id: true,
          status: true,
          staleAt: true,
          clientSafeSummary: true,
          strengths: true,
          cautions: true,
        },
      },
    },
    orderBy: [{ issuer: { name: 'asc' } }, { displayName: 'asc' }, { id: 'asc' }],
    take: 100,
  });
  const now = Date.now();
  return products.map((product) => ({
    ...product,
    currentOfferVersion: product.currentOfferVersion
      ? {
          ...product.currentOfferVersion,
          fresh:
            !product.currentOfferVersion.staleAt &&
            (!product.currentOfferVersion.freshUntil ||
              product.currentOfferVersion.freshUntil.getTime() >= now),
        }
      : null,
    currentInsightVersion:
      product.currentInsightVersion?.status === 'APPROVED' && !product.currentInsightVersion.staleAt
        ? product.currentInsightVersion
        : null,
  }));
}

export async function setStrategyCandidate(
  prisma: PrismaClient,
  input: {
    strategyId: string;
    clientId: string;
    productId: string;
    actorId: string;
    expectedStrategyVersion: number;
    disposition: 'SHORTLISTED' | 'EXCLUDED';
    role?: 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL';
    internalRationale?: string;
    clientSafeReason?: string;
  },
) {
  const strategy = await prisma.roundStrategy.findFirst({
    where: { id: input.strategyId, clientId: input.clientId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const draft = strategy?.versions[0];
  if (!strategy || !draft) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  if (strategy.version !== input.expectedStrategyVersion)
    throw new AppError(
      'STRATEGY_VERSION_CONFLICT',
      409,
      'The strategy changed; refresh before editing',
    );
  if (draft.status !== 'DRAFT' && draft.status !== 'READY_FOR_APPROVAL')
    throw new AppError('STRATEGY_IMMUTABLE', 409, 'Only the current draft can be edited');
  const product = await prisma.cardProduct.findFirst({
    where: { id: input.productId, lifecycle: 'ACTIVE' },
    include: { currentOfferVersion: true, currentInsightVersion: true },
  });
  if (!product?.currentOfferVersion)
    throw new AppError('CURRENT_OFFER_REQUIRED', 409, 'A current governed offer is required');
  const offerVersionId = product.currentOfferVersion.id;
  const insightVersionId =
    product.currentInsightVersion?.status === 'APPROVED' && !product.currentInsightVersion.staleAt
      ? product.currentInsightVersion.id
      : null;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.roundStrategy.updateMany({
      where: { id: strategy.id, version: input.expectedStrategyVersion },
      data: { version: { increment: 1 }, status: 'DRAFT' },
    });
    if (claimed.count !== 1)
      throw new AppError(
        'STRATEGY_VERSION_CONFLICT',
        409,
        'The strategy changed; refresh before editing',
      );
    await tx.strategyCandidate.upsert({
      where: {
        strategyVersionId_productId: { strategyVersionId: draft.id, productId: product.id },
      },
      create: {
        strategyVersionId: draft.id,
        productId: product.id,
        offerVersionId,
        insightVersionId,
        disposition: input.disposition,
        role: input.disposition === 'SHORTLISTED' ? (input.role ?? 'PLANNED') : null,
        ...(input.internalRationale !== undefined
          ? { internalRationale: input.internalRationale }
          : {}),
        ...(input.clientSafeReason !== undefined
          ? { clientSafeReason: input.clientSafeReason }
          : {}),
      },
      update: {
        offerVersionId,
        insightVersionId,
        disposition: input.disposition,
        role: input.disposition === 'SHORTLISTED' ? (input.role ?? 'PLANNED') : null,
        ...(input.internalRationale !== undefined
          ? { internalRationale: input.internalRationale }
          : {}),
        ...(input.clientSafeReason !== undefined
          ? { clientSafeReason: input.clientSafeReason }
          : {}),
      },
    });
    await tx.strategyVersion.update({
      where: { id: draft.id },
      data: { status: 'DRAFT', validation: Prisma.DbNull },
    });
  });
  return strategyProjection(prisma, strategy.id, input.clientId, false);
}

export type StrategySequenceInput = {
  candidateId: string;
  sequence: number;
  role: 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL';
  timingRule: Record<string, unknown>;
  dependencyRule: Record<string, unknown>;
  stopRule: Record<string, unknown>;
  reconsiderationRule: Record<string, unknown>;
  internalRationale: string;
  clientSafeReason: string;
};

export function validateStrategySequence(
  items: StrategySequenceInput[],
  shortlistedIds: Set<string>,
) {
  const errors: string[] = [];
  if (!items.some((item) => item.role === 'PLANNED')) errors.push('PLANNED_APPLICATION_REQUIRED');
  if (new Set(items.map((item) => item.sequence)).size !== items.length)
    errors.push('DUPLICATE_SEQUENCE');
  if (items.some((item) => item.sequence < 1)) errors.push('INVALID_SEQUENCE');
  if (items.some((item) => !shortlistedIds.has(item.candidateId)))
    errors.push('APPLICATION_MUST_REFERENCE_SHORTLIST');
  if (new Set(items.map((item) => item.candidateId)).size !== items.length)
    errors.push('DUPLICATE_CANDIDATE');
  const outcomeKeys = [
    'onApproved',
    'onDeclined',
    'onPending',
    'onSkipped',
    'onNotCompleted',
    'onUnexpected',
  ];
  for (const item of items) {
    if (Object.keys(item.timingRule).length === 0)
      errors.push(`TIMING_RULE_REQUIRED:${item.candidateId}`);
    if (Object.keys(item.dependencyRule).length === 0)
      errors.push(`DEPENDENCY_RULE_REQUIRED:${item.candidateId}`);
    for (const key of outcomeKeys)
      if (!(key in item.stopRule) && !(key in item.reconsiderationRule))
        errors.push(`OUTCOME_RULE_REQUIRED:${key}:${item.candidateId}`);
    if (!item.internalRationale.trim())
      errors.push(`INTERNAL_RATIONALE_REQUIRED:${item.candidateId}`);
    if (!item.clientSafeReason.trim()) errors.push(`CLIENT_REASON_REQUIRED:${item.candidateId}`);
  }
  return { valid: errors.length === 0, errors };
}

async function validateStrategyForApproval(
  prisma: Prisma.TransactionClient,
  strategy: { roundId: string; clientId: string },
  version: {
    sourceFingerprint: string;
    candidates: Array<{
      id: string;
      disposition: string;
      role: string | null;
      internalRationale: string | null;
      clientSafeReason: string | null;
      productId: string;
      offerVersionId: string;
      insightVersionId: string | null;
    }>;
    applications: Array<{
      candidateId: string;
      sequence: number;
      role: 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL';
      timingRule: Prisma.JsonValue;
      dependencyRule: Prisma.JsonValue;
      stopRule: Prisma.JsonValue;
      reconsiderationRule: Prisma.JsonValue;
      internalRationale: string;
      clientSafeReason: string;
    }>;
  },
) {
  const errors: string[] = [];
  const source = await strategySource(prisma, strategy.roundId, strategy.clientId);
  if (source.fingerprint !== version.sourceFingerprint) errors.push('STRATEGY_SOURCE_STALE');
  if (source.context.profile?.status !== 'CURRENT') errors.push('CURRENT_REVIEW_REQUIRED');
  if (!source.context.plan || !['ACTIVE', 'APPROVED'].includes(source.context.plan.status))
    errors.push('PREPARATION_PLAN_REQUIRED');
  if (source.context.plan?.requiredItems.some((item) => item.status !== 'COMPLETED'))
    errors.push('PREPARATION_INCOMPLETE');
  if (!source.context.majorCheck) errors.push('MAJOR_CHECK_REQUIRED');
  const shortlisted = version.candidates.filter(
    (candidate) => candidate.disposition === 'SHORTLISTED',
  );
  if (!shortlisted.length) errors.push('SHORTLIST_REQUIRED');
  for (const candidate of shortlisted) {
    if (!candidate.role) errors.push(`ROLE_REQUIRED:${candidate.id}`);
    if (!candidate.internalRationale?.trim())
      errors.push(`INTERNAL_RATIONALE_REQUIRED:${candidate.id}`);
    if (!candidate.clientSafeReason?.trim()) errors.push(`CLIENT_REASON_REQUIRED:${candidate.id}`);
    const product = await prisma.cardProduct.findUnique({
      where: { id: candidate.productId },
      include: { currentOfferVersion: true, currentInsightVersion: true },
    });
    if (!product || product.lifecycle !== 'ACTIVE')
      errors.push(`PRODUCT_NOT_ACTIVE:${candidate.id}`);
    if (
      !product?.currentOfferVersion ||
      product.currentOfferVersion.id !== candidate.offerVersionId ||
      product.currentOfferVersion.staleAt ||
      (product.currentOfferVersion.freshUntil &&
        product.currentOfferVersion.freshUntil < new Date())
    )
      errors.push(`CURRENT_FRESH_OFFER_REQUIRED:${candidate.id}`);
    if (
      candidate.insightVersionId &&
      (!product?.currentInsightVersion ||
        product.currentInsightVersion.id !== candidate.insightVersionId ||
        product.currentInsightVersion.status !== 'APPROVED' ||
        product.currentInsightVersion.staleAt)
    )
      errors.push(`APPROVED_CURRENT_INSIGHT_REQUIRED:${candidate.id}`);
  }
  const sequence = validateStrategySequence(
    version.applications.map((item) => ({
      candidateId: item.candidateId,
      sequence: item.sequence,
      role: item.role,
      timingRule: item.timingRule as Record<string, unknown>,
      dependencyRule: item.dependencyRule as Record<string, unknown>,
      stopRule: item.stopRule as Record<string, unknown>,
      reconsiderationRule: item.reconsiderationRule as Record<string, unknown>,
      internalRationale: item.internalRationale,
      clientSafeReason: item.clientSafeReason,
    })),
    new Set(shortlisted.map((candidate) => candidate.id)),
  );
  errors.push(...sequence.errors);
  return { valid: errors.length === 0, errors, source };
}

export async function saveStrategySequence(
  prisma: PrismaClient,
  input: {
    strategyId: string;
    clientId: string;
    expectedStrategyVersion: number;
    items: StrategySequenceInput[];
  },
) {
  const strategy = await prisma.roundStrategy.findFirst({
    where: { id: input.strategyId, clientId: input.clientId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { candidates: true } } },
  });
  const draft = strategy?.versions[0];
  if (!strategy || !draft) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  if (strategy.version !== input.expectedStrategyVersion)
    throw new AppError(
      'STRATEGY_VERSION_CONFLICT',
      409,
      'The strategy changed; refresh before editing',
    );
  if (draft.status !== 'DRAFT' && draft.status !== 'READY_FOR_APPROVAL')
    throw new AppError('STRATEGY_IMMUTABLE', 409, 'Only the current draft can be sequenced');
  const validation = validateStrategySequence(
    input.items,
    new Set(
      draft.candidates
        .filter((candidate) => candidate.disposition === 'SHORTLISTED')
        .map((candidate) => candidate.id),
    ),
  );
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.roundStrategy.updateMany({
      where: { id: strategy.id, version: input.expectedStrategyVersion },
      data: {
        version: { increment: 1 },
        status: validation.valid ? 'READY_FOR_APPROVAL' : 'DRAFT',
      },
    });
    if (claimed.count !== 1)
      throw new AppError(
        'STRATEGY_VERSION_CONFLICT',
        409,
        'The strategy changed; refresh before editing',
      );
    await tx.strategyApplication.deleteMany({ where: { strategyVersionId: draft.id } });
    if (input.items.length)
      await tx.strategyApplication.createMany({
        data: input.items.map((item) => ({
          strategyVersionId: draft.id,
          candidateId: item.candidateId,
          sequence: item.sequence,
          role: item.role,
          timingRule: json(item.timingRule),
          dependencyRule: json(item.dependencyRule),
          stopRule: json(item.stopRule),
          reconsiderationRule: json(item.reconsiderationRule),
          internalRationale: item.internalRationale,
          clientSafeReason: item.clientSafeReason,
        })),
      });
    await tx.strategyVersion.update({
      where: { id: draft.id },
      data: {
        status: validation.valid ? 'READY_FOR_APPROVAL' : 'DRAFT',
        rules: json(input.items),
        validation: json(validation),
      },
    });
  });
  return { validation, ...(await strategyProjection(prisma, strategy.id, input.clientId, false)) };
}

export async function approveStrategy(
  prisma: PrismaClient,
  input: {
    strategyId: string;
    clientId: string;
    actorId: string;
    expectedStrategyVersion: number;
    approvalNote: string;
    idempotencyKey: string;
    failAfterMutation?: boolean;
  },
) {
  await assertNoCreditActivityRestriction(prisma, input.clientId, 'STRATEGY');
  const requestHash = hash({
    expectedStrategyVersion: input.expectedStrategyVersion,
    approvalNote: input.approvalNote,
  });
  return executeConsequentialCommand<{ strategyId: string; versionId: string; version: number }>(
    prisma,
    {
      idempotency: {
        scope: 'round-strategy-approval',
        subjectId: input.clientId,
        operation: `approve:${input.strategyId}`,
        key: input.idempotencyKey,
        requestHash,
      },
      audit: (result) => ({
        action: 'ROUND_STRATEGY_APPROVED',
        entityType: 'StrategyVersion',
        entityId: result.versionId,
        clientId: input.clientId,
        actorId: input.actorId,
        metadata: { strategyId: result.strategyId, version: result.version },
      }),
      outbox: {
        eventType: 'round-strategy.approved',
        eventKey: `round-strategy-approved:${input.strategyId}:${input.idempotencyKey}`,
        aggregateType: 'RoundStrategy',
        aggregateId: input.strategyId,
        payload: (result) => ({
          clientId: input.clientId,
          strategyId: result.strategyId,
          versionId: result.versionId,
          version: result.version,
        }),
      },
      mutate: async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`strategy-approve:${input.strategyId}`})) IS NULL AS acquired`,
        );
        const strategy = await tx.roundStrategy.findFirst({
          where: { id: input.strategyId, clientId: input.clientId },
          include: {
            round: true,
            versions: {
              orderBy: { version: 'desc' },
              take: 1,
              include: { candidates: true, applications: true },
            },
          },
        });
        const version = strategy?.versions[0];
        if (!strategy || !version)
          throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
        if (strategy.approvedVersionId === version.id)
          throw new AppError(
            'STRATEGY_ALREADY_APPROVED',
            409,
            'This strategy version is already approved',
          );
        if (strategy.version !== input.expectedStrategyVersion)
          throw new AppError(
            'STRATEGY_VERSION_CONFLICT',
            409,
            'The strategy changed; refresh before approval',
          );
        if (version.status !== 'READY_FOR_APPROVAL')
          throw new AppError(
            'STRATEGY_NOT_READY',
            409,
            'Resolve all strategy validation issues before approval',
          );
        const validation = await validateStrategyForApproval(
          tx,
          { roundId: strategy.roundId, clientId: input.clientId },
          version,
        );
        if (!validation.valid)
          throw new AppError(
            'STRATEGY_NOT_READY',
            409,
            `Strategy validation failed: ${validation.errors.join(', ')}`,
          );
        const approvedAt = new Date();
        if (strategy.approvedVersionId)
          await tx.strategyVersion.update({
            where: { id: strategy.approvedVersionId },
            data: { status: 'SUPERSEDED', supersededAt: approvedAt },
          });
        await tx.strategyVersion.update({
          where: { id: version.id },
          data: {
            status: 'APPROVED',
            approvedByUserId: input.actorId,
            approvalNote: input.approvalNote,
            approvedAt,
            validation: json(validation),
          },
        });
        await tx.roundStrategy.update({
          where: { id: strategy.id },
          data: { status: 'APPROVED', approvedVersionId: version.id, version: { increment: 1 } },
        });
        await tx.creditCardRound.update({
          where: { id: strategy.roundId },
          data: { status: 'READY_FOR_STRATEGY' },
        });
        await tx.workItem.updateMany({
          where: {
            clientId: input.clientId,
            sourceType: 'RoundStrategy',
            sourceId: strategy.id,
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
          },
          data: { status: 'COMPLETED', resolvedAt: approvedAt, completedAt: approvedAt },
        });
        const client = await tx.client.findUnique({
          where: { id: input.clientId },
          select: { userId: true },
        });
        if (client?.userId)
          await tx.notification.upsert({
            where: {
              userId_semanticKey: {
                userId: client.userId,
                semanticKey: `round-strategy-approved:${strategy.id}:${version.id}`,
              },
            },
            create: {
              userId: client.userId,
              clientId: input.clientId,
              semanticKey: `round-strategy-approved:${strategy.id}:${version.id}`,
              type: 'ROUND_STRATEGY_APPROVED',
              category: 'OPERATIONAL',
              title: 'Your card strategy is ready',
              body: 'Your consultant approved a strategy for this Round.',
              link: `/app/rounds/${strategy.roundId}/strategy`,
              safePayload: {
                strategyId: strategy.id,
                roundId: strategy.roundId,
                version: version.version,
              },
            },
            update: {},
          });
        if (input.failAfterMutation) throw new Error('PHASE12_APPROVAL_FAILURE_INJECTION');
        return { strategyId: strategy.id, versionId: version.id, version: version.version };
      },
    },
  );
}
