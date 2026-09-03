import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { identifyClientCard, listClientCards, listWishlist, saveClientCard, setWishlist } from './service.js';

describe('client card portfolio and wishlist', () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(url);
  const marker = randomUUID();
  let actorId = '';
  let clientId = '';
  let otherClientId = '';
  let issuerId = '';
  let productId = '';
  let cardId = '';
  beforeAll(async () => {
    await prisma.$connect();
    actorId = (await prisma.user.create({ data: { email: `portfolio-${marker}@example.test`, role: 'CLIENT', status: 'ACTIVE' } })).id;
    clientId = (await prisma.client.create({ data: { firstName: marker, lastName: 'Owner', termsAcceptedAt: new Date() } })).id;
    otherClientId = (await prisma.client.create({ data: { firstName: marker, lastName: 'Other', termsAcceptedAt: new Date() } })).id;
    issuerId = (await prisma.cardIssuer.create({ data: { slug: `portfolio-issuer-${marker}`, name: 'Portfolio test issuer', aliases: [] } })).id;
    productId = (await prisma.cardProduct.create({ data: { issuerId, slug: `portfolio-product-${marker}`, canonicalName: 'Portfolio test card', displayName: 'Portfolio test card', aliases: [], audience: 'PERSONAL', portfolioType: 'PERSONAL_CREDIT', features: [], tags: [] } })).id;
  });
  afterAll(async () => {
    await prisma.clientCardWishlist.deleteMany({ where: { clientId } });
    await prisma.clientCardIdentityLink.deleteMany({ where: { clientCard: { clientId } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: clientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.clientCard.deleteMany({ where: { clientId } });
    await prisma.cardProduct.delete({ where: { id: productId } });
    await prisma.cardIssuer.delete({ where: { id: issuerId } });
    await prisma.client.deleteMany({ where: { id: { in: [clientId, otherClientId] } } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });

  test('keeps uncertain identity unresolved and preserves identity-link history', async () => {
    const card = await saveClientCard(prisma, { clientId, actorId, cardName: 'Possible card', issuer: 'Unknown bank', scope: 'BUSINESS', portfolioType: 'NON_REPORTING', reportsToBureaus: false });
    cardId = card.id;
    expect(card.identityStatus).toBe('UNRESOLVED');
    await identifyClientCard(prisma, { clientId, actorId, cardId, productId, evidence: { method: 'client-confirmed' } });
    await identifyClientCard(prisma, { clientId, actorId, cardId, productId: null, evidence: { reason: 'ambiguous' } });
    const listed = (await listClientCards(prisma, clientId))[0]!;
    expect(listed.identityStatus).toBe('UNRESOLVED');
    expect(listed.identityLinks).toHaveLength(2);
    await expect(saveClientCard(prisma, { clientId: otherClientId, actorId, cardId, cardName: 'IDOR', issuer: 'No', scope: 'PERSONAL', portfolioType: 'PERSONAL_CREDIT' })).rejects.toThrow();
  });

  test('wishlist save is duplicate-safe and remains preference-only', async () => {
    await setWishlist(prisma, { clientId, actorId, productId, note: 'Research later' });
    await setWishlist(prisma, { clientId, actorId, productId, note: 'Updated preference' });
    const wishlist = await listWishlist(prisma, clientId);
    expect(wishlist).toHaveLength(1);
    expect(wishlist[0]?.note).toBe('Updated preference');
    expect(JSON.stringify(wishlist)).not.toMatch(/apply|eligible|recommended/i);
    await setWishlist(prisma, { clientId, actorId, productId, remove: true });
    expect(await listWishlist(prisma, clientId)).toHaveLength(0);
  });
});
