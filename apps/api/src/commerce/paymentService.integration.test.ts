import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { applyVerifiedPaymentEvent } from './paymentService.js';

describe('verified payment transaction', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint52-${randomUUID()}`;
  let prisma: PrismaClient;
  let clientId: string;
  let userId: string;
  let productId: string;
  let versionId: string;
  const purchaseIds: string[] = [];
  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        role: 'CLIENT',
        client: {
          create: { firstName: 'Payment', lastName: 'Proof', termsAcceptedAt: new Date() },
        },
      },
      include: { client: true },
    });
    userId = user.id;
    clientId = user.client!.id;
    const product = await prisma.serviceProduct.create({
      data: {
        key: marker.toUpperCase().replaceAll('-', '_'),
        active: true,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            status: 'ACTIVE',
            name: 'Verified service',
            description: 'Payment proof',
            price: '29.00',
            currency: 'USD',
            entitlementType: 'CREDIT_PROFILE_REVIEW',
            includedQuantity: 1,
            includedReviewCredits: 2,
          },
        },
      },
      include: { versions: true },
    });
    productId = product.id;
    versionId = product.versions[0]!.id;
  });
  afterAll(async () => {
    await prisma.paymentProviderEvent.deleteMany({
      where: { OR: [{ payment: { clientId } }, { providerEventId: { startsWith: marker } }] },
    });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.reviewCreditTransaction.deleteMany({ where: { clientId } });
    await prisma.serviceEntitlement.deleteMany({ where: { clientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: purchaseIds } } });
    await prisma.payment.deleteMany({ where: { clientId } });
    await prisma.servicePurchase.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.serviceProductVersion.deleteMany({ where: { serviceProductId: productId } });
    await prisma.serviceProduct.delete({ where: { id: productId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
  async function pending(orderId: string) {
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        productVersionId: versionId,
        termsSnapshot: { name: 'Frozen original', amount: '29.00', currency: 'USD' },
        amount: '29.00',
        currency: 'USD',
        paymentProvider: 'PAYPAL',
      },
    });
    purchaseIds.push(purchase.id);
    const payment = await prisma.payment.create({
      data: {
        clientId,
        purchaseId: purchase.id,
        provider: 'PAYPAL',
        providerOrderId: orderId,
        providerEnvironment: 'TEST',
        state: 'PROCESSING',
        amount: '29.00',
        currency: 'USD',
      },
    });
    return { purchase, payment };
  }
  test('verified paid event atomically grants frozen effects exactly once', async () => {
    const { purchase } = await pending(`${marker}-paid`);
    const event = {
      provider: 'PAYPAL' as const,
      providerEventId: `${marker}-event`,
      providerOrderId: `${marker}-paid`,
      providerPaymentId: `${marker}-capture`,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      state: 'SUCCEEDED' as const,
      occurredAt: new Date(),
    };
    expect((await applyVerifiedPaymentEvent(prisma, event)).applied).toBe(true);
    expect((await applyVerifiedPaymentEvent(prisma, event)).reason).toBe('DUPLICATE_EVENT');
    await expect(
      prisma.serviceEntitlement.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.reviewCreditTransaction.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({ where: { userId, semanticKey: `purchase-paid:${purchase.id}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `purchase-paid:${purchase.id}` } }),
    ).resolves.toBe(1);
    expect(
      (await prisma.servicePurchase.findUniqueOrThrow({ where: { id: purchase.id } }))
        .termsSnapshot,
    ).toEqual({ name: 'Frozen original', amount: '29.00', currency: 'USD' });
  });
  test('pending or failed events create no success effects and late failure cannot regress paid', async () => {
    const { purchase } = await pending(`${marker}-ordered`);
    await applyVerifiedPaymentEvent(prisma, {
      provider: 'PAYPAL',
      providerEventId: `${marker}-wait`,
      providerOrderId: `${marker}-ordered`,
      eventType: 'CHECKOUT.ORDER.APPROVED',
      state: 'PROCESSING',
      occurredAt: new Date(),
    });
    await expect(
      prisma.serviceEntitlement.count({ where: { purchaseId: purchase.id } }),
    ).resolves.toBe(0);
    await applyVerifiedPaymentEvent(prisma, {
      provider: 'PAYPAL',
      providerEventId: `${marker}-success`,
      providerOrderId: `${marker}-ordered`,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      state: 'SUCCEEDED',
      occurredAt: new Date(),
    });
    const late = await applyVerifiedPaymentEvent(prisma, {
      provider: 'PAYPAL',
      providerEventId: `${marker}-late`,
      providerOrderId: `${marker}-ordered`,
      eventType: 'PAYMENT.CAPTURE.DENIED',
      state: 'FAILED',
      occurredAt: new Date(),
    });
    expect(late).toMatchObject({ applied: false, reason: 'NON_MONOTONIC_OR_NO_CHANGE' });
    await expect(
      prisma.servicePurchase.findUniqueOrThrow({ where: { id: purchase.id } }),
    ).resolves.toMatchObject({ status: 'PAID' });
  });
  test('unknown authoritative reference is acknowledged without business mutation', async () => {
    const before = await prisma.servicePurchase.count({ where: { clientId } });
    expect(
      await applyVerifiedPaymentEvent(prisma, {
        provider: 'PAYPAL',
        providerEventId: `${marker}-unknown`,
        providerOrderId: 'unknown-order',
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        state: 'SUCCEEDED',
        occurredAt: new Date(),
      }),
    ).toMatchObject({ applied: false, reason: 'UNKNOWN_REFERENCE' });
    await expect(prisma.servicePurchase.count({ where: { clientId } })).resolves.toBe(before);
  });
});
