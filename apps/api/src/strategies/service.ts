import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function strategySource(prisma: PrismaClient, roundId: string, clientId: string) {
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
