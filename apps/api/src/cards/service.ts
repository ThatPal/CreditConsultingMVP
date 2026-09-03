import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const fingerprint = (facts: unknown) =>
  createHash('sha256').update(JSON.stringify(facts)).digest('hex');

export function assertApprovedSourceUrl(raw: string, allowedHosts: string[]) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)))
    throw new AppError('SOURCE_URL_NOT_ALLOWED', 400, 'Source URL is not on the approved HTTPS allowlist');
  if (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host))
    throw new AppError('SOURCE_URL_NOT_ALLOWED', 400, 'Private-network source URLs are prohibited');
  return url.toString();
}

const currentOfferSelect = {
  id: true,
  version: true,
  status: true,
  facts: true,
  effectiveFrom: true,
  publishedAt: true,
  freshUntil: true,
  staleAt: true,
} as const;

export async function listCatalog(prisma: PrismaClient, input: { search?: string | undefined; audience?: 'PERSONAL' | 'BUSINESS' | undefined; portfolioType?: 'PERSONAL_CREDIT' | 'BUSINESS_CREDIT' | 'SECURED' | 'NON_REPORTING' | undefined; includeRetired?: boolean | undefined } = {}) {
  const products = await prisma.cardProduct.findMany({
    where: {
      ...(input.includeRetired ? {} : { lifecycle: 'ACTIVE' }),
      ...(input.audience ? { audience: input.audience } : {}),
      ...(input.portfolioType ? { portfolioType: input.portfolioType } : {}),
      ...(input.search ? { OR: [{ canonicalName: { contains: input.search, mode: 'insensitive' } }, { displayName: { contains: input.search, mode: 'insensitive' } }, { issuer: { name: { contains: input.search, mode: 'insensitive' } } }] } : {}),
    },
    select: {
      id: true, slug: true, canonicalName: true, displayName: true, audience: true,
      portfolioType: true, secured: true, reportsToBureaus: true, features: true, tags: true,
      lifecycle: true, issuer: { select: { id: true, slug: true, name: true, domain: true, logoAssetId: true } },
      currentOfferVersion: { select: currentOfferSelect },
      currentInsightVersion: { where: { status: 'APPROVED' }, select: { id: true, version: true, clientSafeSummary: true, strengths: true, cautions: true, approvedAt: true } },
    },
    orderBy: [{ issuer: { name: 'asc' } }, { displayName: 'asc' }, { id: 'asc' }],
    take: 200,
  });
  const now = Date.now();
  return products.map((product) => ({
    ...product,
    currentOfferVersion: product.currentOfferVersion
      ? { ...product.currentOfferVersion, facts: product.currentOfferVersion.freshUntil && product.currentOfferVersion.freshUntil.getTime() < now ? suppressStalePromotion(product.currentOfferVersion.facts) : product.currentOfferVersion.facts, freshness: product.currentOfferVersion.freshUntil && product.currentOfferVersion.freshUntil.getTime() < now ? 'STALE' : 'CURRENT' }
      : null,
  }));
}

function suppressStalePromotion(facts: unknown) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return facts;
  const stable = Object.fromEntries(
    Object.entries(facts as Record<string, unknown>).filter(
      ([key]) => !['welcomeOffer', 'introductoryApr'].includes(key),
    ),
  );
  return { ...stable, promotionSuppressed: true };
}

export async function offerHistory(prisma: PrismaClient, productId: string) {
  return prisma.cardOfferVersion.findMany({ where: { productId }, select: currentOfferSelect, orderBy: [{ version: 'desc' }, { id: 'desc' }] });
}

export async function publishOffer(prisma: PrismaClient, input: { productId: string; facts: unknown; sourceEvidence: unknown; actorId: string; effectiveFrom?: Date; freshUntil?: Date; eventKey: string }) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.cardProduct.findUnique({ where: { id: input.productId }, include: { currentOfferVersion: true } });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Card product was not found');
    const nextFingerprint = fingerprint(input.facts);
    if (product.currentOfferVersion?.materialFingerprint === nextFingerprint) return product.currentOfferVersion;
    const latest = await tx.cardOfferVersion.aggregate({ where: { productId: product.id }, _max: { version: true } });
    const offer = await tx.cardOfferVersion.create({ data: { productId: product.id, version: (latest._max.version ?? 0) + 1, facts: json(input.facts), sourceEvidence: json(input.sourceEvidence), materialFingerprint: nextFingerprint, ...(input.effectiveFrom ? { effectiveFrom: input.effectiveFrom } : {}), ...(input.freshUntil ? { freshUntil: input.freshUntil } : {}) } });
    if (product.currentOfferVersionId) await tx.cardOfferVersion.update({ where: { id: product.currentOfferVersionId }, data: { status: 'SUPERSEDED', supersededAt: new Date() } });
    await tx.cardProduct.update({ where: { id: product.id }, data: { currentOfferVersionId: offer.id } });
    const stale = await tx.cardInsightVersion.updateMany({ where: { productId: product.id, status: 'APPROVED', offerVersionId: { not: offer.id } }, data: { status: 'STALE', staleAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: input.actorId, action: 'CARD_OFFER_VERSION_PUBLISHED', entityType: 'CardOfferVersion', entityId: offer.id, metadata: json({ productId: product.id, version: offer.version, staleInsights: stale.count }) } });
    await tx.outboxEvent.create({ data: { eventType: 'CardOfferVersionPublished', eventKey: input.eventKey, aggregateType: 'CardProduct', aggregateId: product.id, payload: json({ productId: product.id, offerVersionId: offer.id, version: offer.version }) } });
    return offer;
  });
}

export async function listClientCards(prisma: PrismaClient, clientId: string) {
  return prisma.clientCard.findMany({ where: { clientId }, include: { cardProduct: { select: { id: true, slug: true, displayName: true, issuer: { select: { name: true } }, currentOfferVersion: { select: currentOfferSelect } } }, identityLinks: { orderBy: { linkedAt: 'desc' }, take: 10 } }, orderBy: [{ accountStatus: 'asc' }, { issuer: 'asc' }, { cardName: 'asc' }, { id: 'asc' }] });
}

export async function saveClientCard(prisma: PrismaClient, input: { clientId: string; cardId?: string | undefined; actorId: string; cardName: string; issuer: string; scope: 'PERSONAL' | 'BUSINESS'; portfolioType: 'PERSONAL_CREDIT' | 'BUSINESS_CREDIT' | 'SECURED' | 'NON_REPORTING'; reportsToBureaus?: boolean | null | undefined; maskedIdentifier?: string | null | undefined; creditLimit?: number | null | undefined; balance?: number | null | undefined; accountStatus?: 'OPEN' | 'CLOSED' | undefined }) {
  return prisma.$transaction(async (tx) => {
    const data = { cardName: input.cardName, issuer: input.issuer, scope: input.scope, portfolioType: input.portfolioType, ...(input.reportsToBureaus !== undefined ? { reportsToBureaus: input.reportsToBureaus } : {}), ...(input.maskedIdentifier !== undefined ? { maskedIdentifier: input.maskedIdentifier } : {}), ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}), ...(input.balance !== undefined ? { balance: input.balance } : {}), accountStatus: input.accountStatus ?? 'OPEN' };
    const card = input.cardId
      ? await tx.clientCard.update({ where: { id: input.cardId, clientId: input.clientId }, data })
      : await tx.clientCard.create({ data: { clientId: input.clientId, identityStatus: 'UNRESOLVED', ...data } });
    await tx.auditEvent.create({ data: { clientId: input.clientId, actorId: input.actorId, action: input.cardId ? 'CLIENT_CARD_UPDATED' : 'CLIENT_CARD_ADDED', entityType: 'ClientCard', entityId: card.id } });
    await tx.outboxEvent.create({ data: { eventType: 'ClientCardChanged', eventKey: `client-card:${card.id}:${card.updatedAt.toISOString()}`, aggregateType: 'Client', aggregateId: input.clientId, payload: json({ clientId: input.clientId, cardId: card.id }) } });
    return card;
  });
}

export async function identifyClientCard(prisma: PrismaClient, input: { clientId: string; cardId: string; productId: string | null; evidence: unknown; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.clientCard.findFirst({ where: { id: input.cardId, clientId: input.clientId } });
    if (!card) throw new AppError('NOT_FOUND', 404, 'Client card was not found');
    if (input.productId && !(await tx.cardProduct.findUnique({ where: { id: input.productId }, select: { id: true } }))) throw new AppError('NOT_FOUND', 404, 'Card product was not found');
    await tx.clientCardIdentityLink.updateMany({ where: { clientCardId: card.id, unlinkedAt: null }, data: { unlinkedAt: new Date() } });
    await tx.clientCardIdentityLink.create({ data: { clientCardId: card.id, productId: input.productId, evidence: json(input.evidence), actorId: input.actorId } });
    return tx.clientCard.update({ where: { id: card.id }, data: { cardProductId: input.productId, identityStatus: input.productId ? 'CONFIRMED' : 'UNRESOLVED' } });
  });
}

export async function setWishlist(prisma: PrismaClient, input: { clientId: string; productId: string; note?: string | null | undefined; remove?: boolean | undefined; actorId: string }) {
  return prisma.$transaction(async (tx) => {
    if (input.remove) await tx.clientCardWishlist.deleteMany({ where: { clientId: input.clientId, productId: input.productId } });
    else await tx.clientCardWishlist.upsert({ where: { clientId_productId: { clientId: input.clientId, productId: input.productId } }, create: { clientId: input.clientId, productId: input.productId, ...(input.note !== undefined ? { note: input.note } : {}) }, update: input.note !== undefined ? { note: input.note } : {} });
    await tx.auditEvent.create({ data: { clientId: input.clientId, actorId: input.actorId, action: input.remove ? 'CARD_WISHLIST_REMOVED' : 'CARD_WISHLIST_SAVED', entityType: 'CardProduct', entityId: input.productId } });
    await tx.outboxEvent.upsert({ where: { eventKey: `wishlist:${input.clientId}:${input.productId}:${input.remove ? 'remove' : 'save'}` }, create: { eventType: 'CardWishlistChanged', eventKey: `wishlist:${input.clientId}:${input.productId}:${input.remove ? 'remove' : 'save'}`, aggregateType: 'Client', aggregateId: input.clientId, payload: json({ clientId: input.clientId, productId: input.productId }) }, update: {} });
    return { saved: !input.remove };
  });
}

export async function listWishlist(prisma: PrismaClient, clientId: string) {
  return prisma.clientCardWishlist.findMany({ where: { clientId }, include: { product: { include: { issuer: true, currentOfferVersion: true, currentInsightVersion: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
}

export async function ingestCandidate(prisma: PrismaClient, input: { sourceKey: string; sourceIdentity: string; sourceUrl: string; kind: 'NEW_PRODUCT' | 'OFFER_CHANGE'; matchedProductId?: string | undefined; payload: unknown; evidence: unknown; conflicts?: unknown; materialConflict?: boolean | undefined }) {
  const source = await prisma.cardSource.findUnique({ where: { key: input.sourceKey } });
  if (!source?.active) throw new AppError('SOURCE_NOT_APPROVED', 400, 'Card source is not approved');
  assertApprovedSourceUrl(input.sourceUrl, source.allowedHosts);
  return prisma.cardCatalogCandidate.upsert({ where: { sourceId_sourceIdentity: { sourceId: source.id, sourceIdentity: input.sourceIdentity } }, create: { sourceId: source.id, sourceIdentity: input.sourceIdentity, kind: input.kind, ...(input.matchedProductId ? { matchedProductId: input.matchedProductId } : {}), normalizedPayload: json(input.payload), evidence: json(input.evidence), conflicts: json(input.conflicts ?? []), materialConflict: input.materialConflict ?? false, status: input.materialConflict ? 'CONFLICT' : 'PENDING' }, update: {} });
}

export async function listCandidates(prisma: PrismaClient, status?: 'PENDING' | 'CONFLICT' | 'APPROVED' | 'REJECTED' | 'MERGED') {
  return prisma.cardCatalogCandidate.findMany({ where: status ? { status } : {}, include: { source: { select: { key: true, name: true, official: true } }, matchedProduct: { select: { id: true, displayName: true } } }, orderBy: [{ materialConflict: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }], take: 200 });
}

export async function approveCandidate(prisma: PrismaClient, input: { candidateId: string; expectedVersion: number; actorId: string; reason: string }) {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.cardCatalogCandidate.findUnique({ where: { id: input.candidateId }, include: { source: true } });
    if (!candidate) throw new AppError('NOT_FOUND', 404, 'Catalog candidate was not found');
    if (candidate.version !== input.expectedVersion) throw new AppError('VERSION_CONFLICT', 409, 'Catalog candidate changed');
    if (candidate.status === 'APPROVED') return candidate;
    if (candidate.materialConflict) throw new AppError('MATERIAL_CONFLICT', 409, 'Resolve material source conflicts before publication');
    const payload = candidate.normalizedPayload as Record<string, unknown>;
    let productId = candidate.matchedProductId;
    if (candidate.kind === 'NEW_PRODUCT') {
      const issuerName = String(payload.issuerName ?? 'Unknown issuer');
      const issuerSlug = String(payload.issuerSlug ?? issuerName.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      const issuer = await tx.cardIssuer.upsert({ where: { slug: issuerSlug }, create: { slug: issuerSlug, name: issuerName, aliases: [] }, update: {} });
      const product = await tx.cardProduct.create({ data: { issuerId: issuer.id, slug: String(payload.slug), canonicalName: String(payload.canonicalName), displayName: String(payload.displayName ?? payload.canonicalName), aliases: [], audience: payload.audience === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL', portfolioType: (payload.portfolioType as 'PERSONAL_CREDIT' | 'BUSINESS_CREDIT' | 'SECURED' | 'NON_REPORTING') ?? 'PERSONAL_CREDIT', secured: payload.secured === true, features: json(payload.features ?? []), tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [] } });
      productId = product.id;
    }
    if (!productId) throw new AppError('PRODUCT_REQUIRED', 409, 'Offer candidate has no governed product match');
    const latest = await tx.cardOfferVersion.aggregate({ where: { productId }, _max: { version: true } });
    const facts = payload.facts ?? {};
    const offer = await tx.cardOfferVersion.create({ data: { productId, version: (latest._max.version ?? 0) + 1, facts: json(facts), materialFingerprint: fingerprint(facts), sourceEvidence: json(candidate.evidence) } });
    const product = await tx.cardProduct.findUniqueOrThrow({ where: { id: productId } });
    if (product.currentOfferVersionId) await tx.cardOfferVersion.update({ where: { id: product.currentOfferVersionId }, data: { status: 'SUPERSEDED', supersededAt: new Date() } });
    await tx.cardProduct.update({ where: { id: productId }, data: { currentOfferVersionId: offer.id } });
    await tx.cardSourceMapping.upsert({ where: { sourceId_externalId: { sourceId: candidate.sourceId, externalId: candidate.sourceIdentity } }, create: { sourceId: candidate.sourceId, externalId: candidate.sourceIdentity, productId, evidence: json(candidate.evidence) }, update: { productId, evidence: json(candidate.evidence) } });
    const approved = await tx.cardCatalogCandidate.update({ where: { id: candidate.id }, data: { status: 'APPROVED', matchedProductId: productId, reviewedById: input.actorId, reviewReason: input.reason, reviewedAt: new Date(), version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorId: input.actorId, action: candidate.kind === 'NEW_PRODUCT' ? 'CARD_PRODUCT_APPROVED' : 'CARD_OFFER_CHANGE_APPROVED', entityType: 'CardCatalogCandidate', entityId: candidate.id, metadata: json({ productId, offerVersionId: offer.id, reason: input.reason }) } });
    await tx.outboxEvent.create({ data: { eventType: 'CardOfferVersionPublished', eventKey: `candidate-approved:${candidate.id}`, aggregateType: 'CardProduct', aggregateId: productId, payload: json({ productId, offerVersionId: offer.id }) } });
    return approved;
  });
}

export async function prepareInsight(prisma: PrismaClient, input: { productId: string; actorId: string; summary: string; rationale?: string | undefined; strengths: unknown; cautions: unknown; confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | undefined; evidence: unknown; ai?: { processKey: string; processVersion: number; modelProvenance: unknown; proposedPayload: unknown } | undefined }) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.cardProduct.findUnique({ where: { id: input.productId } });
    if (!product?.currentOfferVersionId) throw new AppError('OFFER_REQUIRED', 409, 'A current offer is required');
    const latest = await tx.cardInsightVersion.aggregate({ where: { productId: product.id }, _max: { version: true } });
    const insight = await tx.cardInsightVersion.create({ data: { productId: product.id, offerVersionId: product.currentOfferVersionId, version: (latest._max.version ?? 0) + 1, status: 'IN_REVIEW', clientSafeSummary: input.summary, ...(input.rationale !== undefined ? { internalRationale: input.rationale } : {}), strengths: json(input.strengths), cautions: json(input.cautions), ...(input.confidence ? { confidence: input.confidence } : {}), evidence: json(input.evidence), ...(input.ai ? { processKey: input.ai.processKey, processVersion: input.ai.processVersion, modelProvenance: json(input.ai.modelProvenance), proposedPayload: json(input.ai.proposedPayload) } : {}) } });
    return insight;
  });
}

export async function approveInsight(prisma: PrismaClient, input: { insightId: string; actorId: string; note: string; idempotencyKey: string; edits?: { summary?: string | undefined; rationale?: string | undefined; strengths?: unknown; cautions?: unknown } | undefined }) {
  return prisma.$transaction(async (tx) => {
    const insight = await tx.cardInsightVersion.findUnique({ where: { id: input.insightId }, include: { product: true } });
    if (!insight) throw new AppError('NOT_FOUND', 404, 'Card insight was not found');
    if (insight.status === 'APPROVED') return insight;
    if (!['PREPARED', 'IN_REVIEW'].includes(insight.status)) throw new AppError('INVALID_STATE', 409, 'Insight cannot be approved');
    if (insight.offerVersionId !== insight.product.currentOfferVersionId) throw new AppError('STALE_INSIGHT', 409, 'Insight does not reference the current offer');
    if (insight.product.currentInsightVersionId) await tx.cardInsightVersion.update({ where: { id: insight.product.currentInsightVersionId }, data: { status: 'SUPERSEDED', supersededAt: new Date() } });
    const approved = await tx.cardInsightVersion.update({ where: { id: insight.id }, data: { status: 'APPROVED', approvedById: input.actorId, approvalNote: input.note, approvedAt: new Date(), ...(input.edits?.summary !== undefined ? { clientSafeSummary: input.edits.summary } : {}), ...(input.edits?.rationale !== undefined ? { internalRationale: input.edits.rationale } : {}), ...(input.edits?.strengths !== undefined ? { strengths: json(input.edits.strengths) } : {}), ...(input.edits?.cautions !== undefined ? { cautions: json(input.edits.cautions) } : {}) } });
    await tx.cardProduct.update({ where: { id: insight.productId }, data: { currentInsightVersionId: approved.id } });
    await tx.workItem.updateMany({ where: { sourceType: 'CARD_INSIGHT', sourceId: insight.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: input.actorId, action: 'CARD_INSIGHT_APPROVED', entityType: 'CardInsightVersion', entityId: insight.id, metadata: json({ note: input.note, edited: Boolean(input.edits) }) } });
    await tx.outboxEvent.upsert({ where: { eventKey: `card-insight-approved:${input.idempotencyKey}` }, create: { eventType: 'CardInsightApproved', eventKey: `card-insight-approved:${input.idempotencyKey}`, aggregateType: 'CardProduct', aggregateId: insight.productId, payload: json({ productId: insight.productId, insightId: insight.id }) }, update: {} });
    return approved;
  });
}
