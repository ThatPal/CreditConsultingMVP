import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function strategySource(prisma: PrismaClient | Prisma.TransactionClient, roundId: string, clientId: string) {
  const round = await prisma.creditCardRound.findFirst({
    where: { id: roundId, clientId },
    include: { goalSnapshot: true, preparationPlanVersion: true, majorApplicationChecks: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  const [profile, review, cards, applications] = await Promise.all([
    prisma.creditProfileState.findUnique({ where: { clientId } }),
    round.sourceReviewId ? prisma.creditReview.findUnique({ where: { id: round.sourceReviewId } }) : null,
    prisma.clientCard.findMany({ where: { clientId }, select: { id: true, updatedAt: true, cardProductId: true }, orderBy: { id: 'asc' } }),
    prisma.cycleApplication.findMany({ where: { cycleId: round.cycleId }, select: { id: true, outcome: true, submittedAt: true }, orderBy: { id: 'asc' } }),
  ]);
  const context = {
    roundId: round.id,
    roundFingerprint: round.sourceFingerprint,
    goal: { id: round.goalSnapshot.sourceGoalId, version: round.goalSnapshot.sourceGoalVersion },
    profile: profile ? { id: profile.id, updatedAt: profile.updatedAt.toISOString(), status: profile.status } : null,
    review: review ? { id: review.id, updatedAt: review.updatedAt.toISOString(), status: review.status } : null,
    planVersionId: round.preparationPlanVersionId,
    clientCards: cards.map((card) => ({ id: card.id, updatedAt: card.updatedAt.toISOString(), productId: card.cardProductId })),
    priorApplications: applications.map((application) => ({ ...application, submittedAt: application.submittedAt.toISOString() })),
    majorCheck: round.majorApplicationChecks[0] ? { id: round.majorApplicationChecks[0].id, version: round.majorApplicationChecks[0].version } : null,
  };
  return { round, context, fingerprint: hash(context) };
}

export async function createStrategyDraft(prisma: PrismaClient, input: { roundId: string; clientId: string; actorId: string }) {
  const source = await strategySource(prisma, input.roundId, input.clientId);
  const strategy = await prisma.roundStrategy.upsert({
    where: { roundId: input.roundId },
    create: { roundId: input.roundId, clientId: input.clientId },
    update: {},
  });
  const latest = await prisma.strategyVersion.findFirst({ where: { strategyId: strategy.id }, orderBy: { version: 'desc' } });
  if (latest?.status === 'APPROVED') throw new AppError('APPROVED_STRATEGY_IMMUTABLE', 409, 'Create a new strategy version to revise an approved strategy');
  if (latest && latest.sourceFingerprint === source.fingerprint) return strategyProjection(prisma, strategy.id, input.clientId, false);
  const proposal = {
    authority: 'PROPOSAL_ONLY',
    themes: ['Protect current profile strength', 'Match products to the frozen client goal'],
    opportunities: ['Review current canonical offers and approved insights'],
    cautions: ['Human consultant selection and approval are required'],
    research: ['Confirm offer freshness immediately before approval'],
  };
  await prisma.strategyVersion.create({ data: {
    strategyId: strategy.id, version: (latest?.version ?? 0) + 1, sourceFingerprint: source.fingerprint,
    sourceContext: json(source.context), aiProposal: json(proposal), createdByUserId: input.actorId,
    brief: json({ proposal, currentContext: source.context, manualFallbackAvailable: true }), rules: json([]),
  } });
  return strategyProjection(prisma, strategy.id, input.clientId, false);
}

export async function strategyProjection(prisma: PrismaClient, strategyId: string, clientId: string, clientSafe: boolean) {
  const strategy = await prisma.roundStrategy.findFirst({ where: { id: strategyId, clientId }, include: { versions: { include: { candidates: true, applications: true }, orderBy: { version: 'desc' } } } });
  if (!strategy) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  const current = strategy.versions[0] ?? null;
  const approved = strategy.approvedVersionId ? strategy.versions.find((version) => version.id === strategy.approvedVersionId) ?? null : null;
  if (clientSafe) {
    if (!approved) return { strategy: { id: strategy.id, roundId: strategy.roundId, status: strategy.status }, approved: null };
    return { strategy: { id: strategy.id, roundId: strategy.roundId, status: strategy.status }, approved: {
      id: approved.id, version: approved.version, approvedAt: approved.approvedAt,
      cards: approved.candidates.filter((candidate) => candidate.disposition === 'SHORTLISTED').map((candidate) => ({ productId: candidate.productId, role: candidate.role, reason: candidate.clientSafeReason })),
      sequence: approved.applications.map((item) => ({ sequence: item.sequence, role: item.role, reason: item.clientSafeReason, timingRule: item.timingRule, dependencyRule: item.dependencyRule, stopRule: item.stopRule, reconsiderationRule: item.reconsiderationRule })),
    } };
  }
  return { strategy, current, approved };
}

export async function getRoundStrategy(prisma: PrismaClient, roundId: string, clientId: string, clientSafe = false) {
  const strategy = await prisma.roundStrategy.findFirst({ where: { roundId, clientId } });
  if (!strategy) return { strategy: null, approved: null };
  const source = await strategySource(prisma, roundId, clientId);
  const current = await prisma.strategyVersion.findFirst({ where: { strategyId: strategy.id }, orderBy: { version: 'desc' } });
  if (current && current.status !== 'APPROVED' && current.sourceFingerprint !== source.fingerprint) {
    await prisma.$transaction([
      prisma.strategyVersion.update({ where: { id: current.id }, data: { status: 'STALE', staleAt: new Date() } }),
      prisma.roundStrategy.update({ where: { id: strategy.id }, data: { status: 'STALE', version: { increment: 1 } } }),
    ]);
  }
  return strategyProjection(prisma, strategy.id, clientId, clientSafe);
}

export async function strategyCatalog(prisma: PrismaClient, search?: string) {
  return prisma.cardProduct.findMany({
    where: { lifecycle: 'ACTIVE', ...(search ? { OR: [{ displayName: { contains: search, mode: 'insensitive' } }, { issuer: { name: { contains: search, mode: 'insensitive' } } }] } : {}) },
    include: { issuer: true, currentOfferVersion: true, currentInsightVersion: true },
    orderBy: [{ issuer: { name: 'asc' } }, { displayName: 'asc' }, { id: 'asc' }], take: 100,
  });
}

export async function setStrategyCandidate(prisma: PrismaClient, input: {
  strategyId: string; clientId: string; productId: string; actorId: string; expectedStrategyVersion: number;
  disposition: 'SHORTLISTED' | 'EXCLUDED'; role?: 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL'; internalRationale?: string; clientSafeReason?: string;
}) {
  const strategy = await prisma.roundStrategy.findFirst({ where: { id: input.strategyId, clientId: input.clientId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  const draft = strategy?.versions[0];
  if (!strategy || !draft) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  if (strategy.version !== input.expectedStrategyVersion) throw new AppError('STRATEGY_VERSION_CONFLICT', 409, 'The strategy changed; refresh before editing');
  if (draft.status !== 'DRAFT') throw new AppError('STRATEGY_IMMUTABLE', 409, 'Only a draft strategy can be edited');
  const product = await prisma.cardProduct.findFirst({ where: { id: input.productId, lifecycle: 'ACTIVE' }, include: { currentOfferVersion: true, currentInsightVersion: true } });
  if (!product?.currentOfferVersion) throw new AppError('CURRENT_OFFER_REQUIRED', 409, 'A current governed offer is required');
  const offerVersionId = product.currentOfferVersion.id;
  const insightVersionId = product.currentInsightVersion?.id ?? null;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.roundStrategy.updateMany({ where: { id: strategy.id, version: input.expectedStrategyVersion }, data: { version: { increment: 1 } } });
    if (claimed.count !== 1) throw new AppError('STRATEGY_VERSION_CONFLICT', 409, 'The strategy changed; refresh before editing');
    await tx.strategyCandidate.upsert({ where: { strategyVersionId_productId: { strategyVersionId: draft.id, productId: product.id } }, create: {
      strategyVersionId: draft.id, productId: product.id, offerVersionId, insightVersionId,
      disposition: input.disposition, role: input.disposition === 'SHORTLISTED' ? (input.role ?? 'PLANNED') : null,
      ...(input.internalRationale !== undefined ? { internalRationale: input.internalRationale } : {}), ...(input.clientSafeReason !== undefined ? { clientSafeReason: input.clientSafeReason } : {}),
    }, update: { offerVersionId, insightVersionId, disposition: input.disposition, role: input.disposition === 'SHORTLISTED' ? (input.role ?? 'PLANNED') : null, ...(input.internalRationale !== undefined ? { internalRationale: input.internalRationale } : {}), ...(input.clientSafeReason !== undefined ? { clientSafeReason: input.clientSafeReason } : {}) } });
  });
  return strategyProjection(prisma, strategy.id, input.clientId, false);
}

export type StrategySequenceInput = {
  candidateId: string; sequence: number; role: 'PLANNED' | 'ALTERNATIVE' | 'CONDITIONAL';
  timingRule: Record<string, unknown>; dependencyRule: Record<string, unknown>;
  stopRule: Record<string, unknown>; reconsiderationRule: Record<string, unknown>;
  internalRationale: string; clientSafeReason: string;
};

export function validateStrategySequence(items: StrategySequenceInput[], shortlistedIds: Set<string>) {
  const errors: string[] = [];
  if (!items.some((item) => item.role === 'PLANNED')) errors.push('PLANNED_APPLICATION_REQUIRED');
  if (new Set(items.map((item) => item.sequence)).size !== items.length) errors.push('DUPLICATE_SEQUENCE');
  if (items.some((item) => item.sequence < 1)) errors.push('INVALID_SEQUENCE');
  if (items.some((item) => !shortlistedIds.has(item.candidateId))) errors.push('APPLICATION_MUST_REFERENCE_SHORTLIST');
  const outcomeKeys = ['onApproved', 'onDeclined', 'onPending', 'onSkipped', 'onNotCompleted', 'onUnexpected'];
  for (const item of items) {
    if (Object.keys(item.timingRule).length === 0) errors.push(`TIMING_RULE_REQUIRED:${item.candidateId}`);
    if (Object.keys(item.dependencyRule).length === 0) errors.push(`DEPENDENCY_RULE_REQUIRED:${item.candidateId}`);
    for (const key of outcomeKeys) if (!(key in item.stopRule) && !(key in item.reconsiderationRule)) errors.push(`OUTCOME_RULE_REQUIRED:${key}:${item.candidateId}`);
    if (!item.internalRationale.trim()) errors.push(`INTERNAL_RATIONALE_REQUIRED:${item.candidateId}`);
    if (!item.clientSafeReason.trim()) errors.push(`CLIENT_REASON_REQUIRED:${item.candidateId}`);
  }
  return { valid: errors.length === 0, errors };
}

export async function saveStrategySequence(prisma: PrismaClient, input: { strategyId: string; clientId: string; expectedStrategyVersion: number; items: StrategySequenceInput[] }) {
  const strategy = await prisma.roundStrategy.findFirst({ where: { id: input.strategyId, clientId: input.clientId }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { candidates: true } } } });
  const draft = strategy?.versions[0];
  if (!strategy || !draft) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
  if (strategy.version !== input.expectedStrategyVersion) throw new AppError('STRATEGY_VERSION_CONFLICT', 409, 'The strategy changed; refresh before editing');
  if (draft.status !== 'DRAFT' && draft.status !== 'READY_FOR_APPROVAL') throw new AppError('STRATEGY_IMMUTABLE', 409, 'Only the current draft can be sequenced');
  const validation = validateStrategySequence(input.items, new Set(draft.candidates.filter((candidate) => candidate.disposition === 'SHORTLISTED').map((candidate) => candidate.id)));
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.roundStrategy.updateMany({ where: { id: strategy.id, version: input.expectedStrategyVersion }, data: { version: { increment: 1 }, status: validation.valid ? 'READY_FOR_APPROVAL' : 'DRAFT' } });
    if (claimed.count !== 1) throw new AppError('STRATEGY_VERSION_CONFLICT', 409, 'The strategy changed; refresh before editing');
    await tx.strategyApplication.deleteMany({ where: { strategyVersionId: draft.id } });
    if (input.items.length) await tx.strategyApplication.createMany({ data: input.items.map((item) => ({ strategyVersionId: draft.id, candidateId: item.candidateId, sequence: item.sequence, role: item.role, timingRule: json(item.timingRule), dependencyRule: json(item.dependencyRule), stopRule: json(item.stopRule), reconsiderationRule: json(item.reconsiderationRule), internalRationale: item.internalRationale, clientSafeReason: item.clientSafeReason })) });
    await tx.strategyVersion.update({ where: { id: draft.id }, data: { status: validation.valid ? 'READY_FOR_APPROVAL' : 'DRAFT', rules: json(input.items), validation: json(validation) } });
  });
  return { validation, ...(await strategyProjection(prisma, strategy.id, input.clientId, false)) };
}

export async function approveStrategy(prisma: PrismaClient, input: { strategyId: string; clientId: string; actorId: string; expectedStrategyVersion: number; approvalNote: string; idempotencyKey: string; failAfterMutation?: boolean }) {
  const requestHash = hash({ expectedStrategyVersion: input.expectedStrategyVersion, approvalNote: input.approvalNote });
  return executeConsequentialCommand<{ strategyId: string; versionId: string; version: number }>(prisma, {
    idempotency: { scope: 'round-strategy-approval', subjectId: input.clientId, operation: `approve:${input.strategyId}`, key: input.idempotencyKey, requestHash },
    audit: (result) => ({ action: 'ROUND_STRATEGY_APPROVED', entityType: 'StrategyVersion', entityId: result.versionId, clientId: input.clientId, actorId: input.actorId, metadata: { strategyId: result.strategyId, version: result.version } }),
    outbox: { eventType: 'round-strategy.approved', eventKey: `round-strategy-approved:${input.strategyId}:${input.idempotencyKey}`, aggregateType: 'RoundStrategy', aggregateId: input.strategyId, payload: (result) => ({ clientId: input.clientId, strategyId: result.strategyId, versionId: result.versionId, version: result.version }) },
    mutate: async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`strategy-approve:${input.strategyId}`})) IS NULL AS acquired`);
      const strategy = await tx.roundStrategy.findFirst({ where: { id: input.strategyId, clientId: input.clientId }, include: { round: true, versions: { orderBy: { version: 'desc' }, take: 1, include: { candidates: true, applications: true } } } });
      const version = strategy?.versions[0];
      if (!strategy || !version) throw new AppError('STRATEGY_NOT_FOUND', 404, 'Strategy was not found');
      if (strategy.approvedVersionId) throw new AppError('STRATEGY_ALREADY_APPROVED', 409, 'This strategy version is already approved');
      if (strategy.version !== input.expectedStrategyVersion) throw new AppError('STRATEGY_VERSION_CONFLICT', 409, 'The strategy changed; refresh before approval');
      if (version.status !== 'READY_FOR_APPROVAL') throw new AppError('STRATEGY_NOT_READY', 409, 'Resolve all strategy validation issues before approval');
      const currentSource = await strategySource(tx, strategy.roundId, input.clientId);
      if (currentSource.fingerprint !== version.sourceFingerprint) throw new AppError('STRATEGY_SOURCE_STALE', 409, 'Authoritative source data changed; prepare a new strategy version');
      const validation = validateStrategySequence(version.applications.map((item) => ({ candidateId: item.candidateId, sequence: item.sequence, role: item.role, timingRule: item.timingRule as Record<string, unknown>, dependencyRule: item.dependencyRule as Record<string, unknown>, stopRule: item.stopRule as Record<string, unknown>, reconsiderationRule: item.reconsiderationRule as Record<string, unknown>, internalRationale: item.internalRationale, clientSafeReason: item.clientSafeReason })), new Set(version.candidates.filter((candidate) => candidate.disposition === 'SHORTLISTED').map((candidate) => candidate.id)));
      if (!validation.valid) throw new AppError('STRATEGY_NOT_READY', 409, 'Strategy validation failed');
      const approvedAt = new Date();
      await tx.strategyVersion.update({ where: { id: version.id }, data: { status: 'APPROVED', approvedByUserId: input.actorId, approvalNote: input.approvalNote, approvedAt, validation: json(validation) } });
      await tx.roundStrategy.update({ where: { id: strategy.id }, data: { status: 'APPROVED', approvedVersionId: version.id, version: { increment: 1 } } });
      await tx.creditCardRound.update({ where: { id: strategy.roundId }, data: { status: 'READY_FOR_STRATEGY' } });
      const client = await tx.client.findUnique({ where: { id: input.clientId }, select: { userId: true } });
      if (client?.userId) await tx.notification.upsert({ where: { userId_semanticKey: { userId: client.userId, semanticKey: `round-strategy-approved:${strategy.id}:${version.id}` } }, create: { userId: client.userId, clientId: input.clientId, semanticKey: `round-strategy-approved:${strategy.id}:${version.id}`, type: 'ROUND_STRATEGY_APPROVED', category: 'OPERATIONAL', title: 'Your card strategy is ready', body: 'Your consultant approved a strategy for this Round.', link: `/app/rounds/${strategy.roundId}/strategy`, safePayload: { strategyId: strategy.id, roundId: strategy.roundId, version: version.version } }, update: {} });
      if (input.failAfterMutation) throw new Error('PHASE12_APPROVAL_FAILURE_INJECTION');
      return { strategyId: strategy.id, versionId: version.id, version: version.version };
    },
  });
}
