import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { seedSystemReferenceData } from '../seeding/systemSeed.js';
import { grantVerifiedPurchaseEffects } from './domain.js';

describe('commercial grant transaction', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint51-${randomUUID()}`;
  let prisma: PrismaClient;
  let actorId: string;
  let clientId: string;
  let productId: string;
  let versionId: string;
  const purchaseIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    await seedSystemReferenceData(prisma);
    const actor = await prisma.user.create({
      data: { email: `${marker}-admin@example.test`, role: 'ADMIN' },
    });
    const clientUser = await prisma.user.create({
      data: {
        email: `${marker}-client@example.test`,
        role: 'CLIENT',
        client: {
          create: { firstName: 'Commerce', lastName: 'Proof', termsAcceptedAt: new Date() },
        },
      },
      include: { client: true },
    });
    const product = await prisma.serviceProduct.create({
      data: {
        key: marker.toUpperCase().replaceAll('-', '_'),
        versions: {
          create: {
            version: 1,
            status: 'ACTIVE',
            name: 'Proof service',
            description: 'Transactional proof service',
            price: '19.99',
            entitlementType: 'CREDIT_PROFILE_REVIEW',
            includedQuantity: 1,
            includedReviewCredits: 3,
          },
        },
      },
      include: { versions: true },
    });
    actorId = actor.id;
    clientId = clientUser.client!.id;
    productId = product.id;
    versionId = product.versions[0]!.id;
  });

  afterAll(async () => {
    await prisma.reviewCreditTransaction.deleteMany({ where: { clientId } });
    await prisma.serviceEntitlement.deleteMany({ where: { clientId } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ clientId }, { actorId }] } });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateType: 'ServicePurchase', aggregateId: { in: purchaseIds } },
    });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: clientId } });
    await prisma.servicePurchase.deleteMany({ where: { id: { in: purchaseIds } } });
    if (productId) {
      await prisma.serviceProductVersion.deleteMany({ where: { serviceProductId: productId } });
      await prisma.serviceProduct.delete({ where: { id: productId } });
    }
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: marker } } });
    await prisma.$disconnect();
  });

  test('replay creates one canonical entitlement, credit entry, audit, and outbox event', async () => {
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        productVersionId: versionId,
        amount: '19.99',
        status: 'PAID',
        purchasedAt: new Date(),
      },
    });
    purchaseIds.push(purchase.id);
    const first = await grantVerifiedPurchaseEffects(prisma, {
      purchaseId: purchase.id,
      actorId,
      idempotencyKey: `${marker}-replay`,
    });
    const replay = await grantVerifiedPurchaseEffects(prisma, {
      purchaseId: purchase.id,
      actorId,
      idempotencyKey: `${marker}-replay`,
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    await expect(
      prisma.serviceEntitlement.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.reviewCreditTransaction.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { entityId: purchase.id, action: 'COMMERCIAL_EFFECTS_GRANTED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `commerce-effects:${purchase.id}` } }),
    ).resolves.toBe(1);
  });

  test('rolls back business, ledger, and audit effects when the outbox write fails', async () => {
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        productVersionId: versionId,
        amount: '19.99',
        status: 'PAID',
      },
    });
    purchaseIds.push(purchase.id);
    await prisma.outboxEvent.create({
      data: {
        eventType: 'collision',
        eventKey: `commerce-effects:${purchase.id}`,
        aggregateType: 'ServicePurchase',
        aggregateId: purchase.id,
        payload: {},
      },
    });
    await expect(
      grantVerifiedPurchaseEffects(prisma, {
        purchaseId: purchase.id,
        actorId,
        idempotencyKey: `${marker}-rollback`,
      }),
    ).rejects.toBeTruthy();
    await expect(
      prisma.serviceEntitlement.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.reviewCreditTransaction.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditEvent.count({
        where: { entityId: purchase.id, action: 'COMMERCIAL_EFFECTS_GRANTED' },
      }),
    ).resolves.toBe(0);
  });
});
