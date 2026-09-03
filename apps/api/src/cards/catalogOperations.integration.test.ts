import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { approveCandidate, ingestCandidate, reviewCandidate } from './service.js';

describe('governed catalog candidate operations', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(url);
  const marker = randomUUID();
  let actorId = '';
  let sourceId = '';
  const productIds: string[] = [];
  beforeAll(async () => {
    await prisma.$connect();
    actorId = (await prisma.user.create({ data: { email: `catalog-ops-${marker}@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } })).id;
    sourceId = (await prisma.cardSource.create({ data: { key: `source-${marker}`, name: 'Official test source', baseUrl: 'https://issuer.example/cards', allowedHosts: ['issuer.example'], official: true } })).id;
  });
  afterAll(async () => {
    const candidates = await prisma.cardCatalogCandidate.findMany({ where: { sourceId }, select: { matchedProductId: true } });
    productIds.push(...candidates.flatMap((candidate) => candidate.matchedProductId ? [candidate.matchedProductId] : []));
    await prisma.cardSourceMapping.deleteMany({ where: { sourceId } });
    await prisma.cardCatalogCandidate.deleteMany({ where: { sourceId } });
    await prisma.outboxEvent.deleteMany({ where: { eventKey: { startsWith: 'candidate-approved:' } } });
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    for (const productId of [...new Set(productIds)]) {
      await prisma.cardProduct.update({ where: { id: productId }, data: { currentOfferVersionId: null } }).catch(() => undefined);
      await prisma.cardOfferVersion.deleteMany({ where: { productId } });
      await prisma.cardProduct.delete({ where: { id: productId } }).catch(() => undefined);
    }
    await prisma.cardIssuer.deleteMany({ where: { slug: { startsWith: `issuer-${marker}` } } });
    await prisma.cardSource.delete({ where: { id: sourceId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('replay is duplicate-safe and human approval creates one product/evidence set', async () => {
    const input = { sourceKey: `source-${marker}`, sourceIdentity: 'product-1', sourceUrl: 'https://issuer.example/cards/one', kind: 'NEW_PRODUCT' as const, payload: { issuerName: 'Test issuer', issuerSlug: `issuer-${marker}`, slug: `product-${marker}`, canonicalName: 'Governed Card', facts: { annualFee: 0 } }, evidence: { url: 'https://issuer.example/cards/one', capturedAt: new Date().toISOString() } };
    const first = await ingestCandidate(prisma, input);
    const replay = await ingestCandidate(prisma, input);
    expect(replay.id).toBe(first.id);
    await approveCandidate(prisma, { candidateId: first.id, expectedVersion: 1, actorId, reason: 'Official evidence verified' });
    const approved = await prisma.cardCatalogCandidate.findUniqueOrThrow({ where: { id: first.id } });
    productIds.push(approved.matchedProductId!);
    expect(await prisma.cardProduct.count({ where: { slug: `product-${marker}` } })).toBe(1);
    expect(await prisma.cardOfferVersion.count({ where: { productId: approved.matchedProductId! } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { eventKey: `candidate-approved:${first.id}` } })).toBe(1);
  });

  test('material conflict blocks publication and version protection prevents concurrent effects', async () => {
    const productId = productIds[0]!;
    const candidate = await ingestCandidate(prisma, { sourceKey: `source-${marker}`, sourceIdentity: 'offer-conflict', sourceUrl: 'https://issuer.example/cards/one', kind: 'OFFER_CHANGE', matchedProductId: productId, payload: { facts: { annualFee: 95 } }, evidence: { fields: ['annualFee'] }, conflicts: [{ field: 'annualFee', values: [0, 95] }], materialConflict: true });
    await expect(approveCandidate(prisma, { candidateId: candidate.id, expectedVersion: 1, actorId, reason: 'premature' })).rejects.toMatchObject({ code: 'MATERIAL_CONFLICT' });
    const resolved = await reviewCandidate(prisma, { candidateId: candidate.id, expectedVersion: 1, actorId, action: 'RESOLVE_CONFLICT', reason: 'Official issuer terms verified', matchedProductId: productId });
    const attempts = await Promise.allSettled([approveCandidate(prisma, { candidateId: candidate.id, expectedVersion: resolved.version, actorId, reason: 'publish' }), approveCandidate(prisma, { candidateId: candidate.id, expectedVersion: resolved.version, actorId, reason: 'publish' })]);
    expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.cardOfferVersion.count({ where: { productId } })).toBe(2);
    expect((await prisma.cardOfferVersion.findFirstOrThrow({ where: { productId, version: 1 } })).facts).toEqual({ annualFee: 0 });
  });
});
