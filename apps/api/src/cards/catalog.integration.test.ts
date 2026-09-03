import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { assertApprovedSourceUrl, listCatalog, offerHistory, publishOffer } from './service.js';

describe('canonical card catalog', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
  const marker = randomUUID();
  let actorId = '';
  let issuerId = '';
  let productId = '';

  beforeAll(async () => {
    await prisma.$connect();
    actorId = (await prisma.user.create({ data: { email: `catalog-${marker}@example.test`, role: 'CONSULTANT', status: 'ACTIVE' } })).id;
    issuerId = (await prisma.cardIssuer.create({ data: { slug: `issuer-${marker}`, name: 'Test issuer', aliases: ['Test Bank'] } })).id;
    productId = (await prisma.cardProduct.create({ data: { issuerId, slug: `product-${marker}`, canonicalName: `Test card ${marker}`, displayName: 'Test card', aliases: ['Legacy name'], audience: 'PERSONAL', portfolioType: 'PERSONAL_CREDIT', features: [], tags: [] } })).id;
  });

  afterAll(async () => {
    await prisma.cardProduct.update({ where: { id: productId }, data: { currentOfferVersionId: null } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: productId } });
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    await prisma.cardOfferVersion.deleteMany({ where: { productId } });
    await prisma.cardProduct.delete({ where: { id: productId } });
    await prisma.cardIssuer.delete({ where: { id: issuerId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('advances the current pointer without mutating immutable history', async () => {
    const first = await publishOffer(prisma, { productId, actorId, facts: { annualFee: 0 }, sourceEvidence: { url: 'https://issuer.example/card' }, eventKey: `offer:${marker}:1` });
    const second = await publishOffer(prisma, { productId, actorId, facts: { annualFee: 95 }, sourceEvidence: { url: 'https://issuer.example/card' }, eventKey: `offer:${marker}:2` });
    expect(second.version).toBe(2);
    expect((await awaitHistory())[1]).toMatchObject({ id: first.id, status: 'SUPERSEDED', facts: { annualFee: 0 } });
    const product = await prisma.cardProduct.findUniqueOrThrow({ where: { id: productId } });
    expect(product.currentOfferVersionId).toBe(second.id);
  });

  test('positively selects catalog data and rejects unsafe source URLs', async () => {
    const product = (await listCatalog(prisma, { search: marker }))[0]!;
    expect(product).not.toHaveProperty('currentOfferVersion.sourceEvidence');
    expect(product).not.toHaveProperty('issuer.aliases');
    expect(() => assertApprovedSourceUrl('http://127.0.0.1/private', ['issuer.example'])).toThrow('approved HTTPS allowlist');
    expect(assertApprovedSourceUrl('https://cards.issuer.example/product', ['issuer.example'])).toContain('cards.issuer.example');
  });

  function awaitHistory() { return offerHistory(prisma, productId); }
});
