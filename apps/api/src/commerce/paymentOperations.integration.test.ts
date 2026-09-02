import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PaymentProvider, PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import {
  BankOfAmericaGateway,
  DeterministicPaymentGateway,
  PaymentGatewayRegistry,
} from './paymentGateway.js';
import { reconcilePayment, requestRefund, setDefaultGateway } from './paymentOperations.js';
import { applyVerifiedPaymentEvent } from './paymentService.js';

describe('Sprint 5.5 gateway and original-provider operations', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint55-${randomUUID()}`;
  let prisma: PrismaClient;
  let userId: string;
  let clientId: string;
  let productId: string;
  let versionId: string;
  const purchaseIds: string[] = [];
  const paypal = new DeterministicPaymentGateway('SUCCEEDED', true, 'PAYPAL');
  const stripe = new DeterministicPaymentGateway('SUCCEEDED', true, 'STRIPE');
  const bofa = new BankOfAmericaGateway({});
  const registry = new PaymentGatewayRegistry([paypal, stripe, bofa], 'STRIPE');

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        role: 'CLIENT',
        client: {
          create: { firstName: 'Commerce', lastName: 'Proof', termsAcceptedAt: new Date() },
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
            name: 'Refundable service',
            description: 'Sprint 5.5 proof',
            price: '100.00',
            currency: 'USD',
            entitlementType: 'CREDIT_PROFILE_REVIEW',
            includedQuantity: 1,
            includedReviewCredits: 1,
          },
        },
      },
      include: { versions: true },
    });
    productId = product.id;
    versionId = product.versions[0]!.id;
    for (const provider of ['PAYPAL', 'STRIPE', 'BOFA_MERCHANT'] as PaymentProvider[])
      await prisma.paymentGatewayConfig.upsert({
        where: { provider },
        create: {
          provider,
          environment: 'TEST',
          configured: true,
          connected: true,
          enabledForNewPayments: true,
          defaultForCheckout: false,
          status: 'HEALTHY',
          secretReferences: [],
        },
        update: {
          configured: true,
          connected: true,
          enabledForNewPayments: true,
          defaultForCheckout: false,
        },
      });
    await prisma.paymentGatewayConfig.update({
      where: { provider: 'PAYPAL' },
      data: { defaultForCheckout: true },
    });
  });

  afterAll(async () => {
    await prisma.paymentProviderEvent.deleteMany({ where: { payment: { clientId } } });
    await prisma.paymentDispute.deleteMany({ where: { clientId } });
    await prisma.paymentReconciliation.deleteMany({ where: { payment: { clientId } } });
    await prisma.paymentRefund.deleteMany({ where: { clientId } });
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
    await prisma.paymentGatewayConfig.deleteMany({
      where: { provider: { in: ['PAYPAL', 'STRIPE', 'BOFA_MERCHANT'] } },
    });
    await prisma.$disconnect();
  });

  async function paid(provider: PaymentProvider, suffix: string) {
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        productVersionId: versionId,
        termsSnapshot: { price: '100.00' },
        amount: '100.00',
        currency: 'USD',
        status: 'PAID',
        paymentProvider: provider,
        paymentReference: `${marker}-${suffix}-capture`,
        purchasedAt: new Date(),
      },
    });
    purchaseIds.push(purchase.id);
    const payment = await prisma.payment.create({
      data: {
        clientId,
        purchaseId: purchase.id,
        provider,
        providerEnvironment: 'TEST',
        providerOrderId: `${marker}-${suffix}-order`,
        providerPaymentId: `${marker}-${suffix}-capture`,
        state: 'SUCCEEDED',
        amount: '100.00',
        currency: 'USD',
      },
    });
    await prisma.serviceEntitlement.create({
      data: {
        clientId,
        purchaseId: purchase.id,
        productVersionId: versionId,
        sourceKey: `${marker}-${suffix}-entitlement`,
        serviceType: 'CREDIT_PROFILE_REVIEW',
      },
    });
    await prisma.reviewCreditTransaction.create({
      data: {
        clientId,
        purchaseId: purchase.id,
        productVersionId: versionId,
        sourceKey: `${marker}-${suffix}-credit`,
        transactionType: 'PURCHASE',
        availableDelta: 1,
      },
    });
    return { payment, purchase };
  }

  test('concurrent default changes preserve exactly one enabled default', async () => {
    await Promise.allSettled([
      setDefaultGateway(prisma, 'STRIPE', userId),
      setDefaultGateway(prisma, 'BOFA_MERCHANT', userId),
    ]);
    const defaults = await prisma.paymentGatewayConfig.findMany({
      where: { defaultForCheckout: true },
    });
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.enabledForNewPayments).toBe(true);
  });

  test('refund uses immutable original provider, is replay-safe, and concurrent requests cannot over-refund', async () => {
    const { payment, purchase } = await paid('PAYPAL', 'refund');
    await setDefaultGateway(prisma, 'STRIPE', userId);
    const key = `${marker}-refund-key`;
    const first = await requestRefund(prisma, registry, {
      paymentId: payment.id,
      amount: '40.00',
      actorId: userId,
      idempotencyKey: key,
    });
    const replay = await requestRefund(prisma, registry, {
      paymentId: payment.id,
      amount: '40.00',
      actorId: userId,
      idempotencyKey: key,
    });
    expect(replay.id).toBe(first.id);
    expect(first.provider).toBe('PAYPAL');
    const racing = await Promise.allSettled(
      ['a', 'b'].map((suffix) =>
        requestRefund(prisma, registry, {
          paymentId: payment.id,
          amount: '40.00',
          actorId: userId,
          idempotencyKey: `${marker}-race-${suffix}`,
        }),
      ),
    );
    expect(racing.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    await expect(
      prisma.paymentRefund.count({ where: { paymentId: payment.id, status: 'SUCCEEDED' } }),
    ).resolves.toBe(2);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `refund-succeeded:${first.id}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({ where: { semanticKey: `refund-succeeded:${first.id}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.servicePurchase.findUniqueOrThrow({ where: { id: purchase.id } }),
    ).resolves.toMatchObject({ status: 'PAID' });
  });

  test('BofA unsupported refund and reconciliation fail closed without cross-provider effects', async () => {
    const { payment } = await paid('BOFA_MERCHANT', 'bofa');
    await expect(
      requestRefund(prisma, registry, {
        paymentId: payment.id,
        amount: '10.00',
        actorId: userId,
        idempotencyKey: `${marker}-bofa-refund`,
      }),
    ).rejects.toThrow('BOFA_REFUND_UNSUPPORTED_WITH_HOSTED_PROFILE');
    const attempt = await reconcilePayment(prisma, registry, {
      paymentId: payment.id,
      actorId: userId,
      idempotencyKey: `${marker}-bofa-reconcile`,
    });
    expect(attempt).toMatchObject({
      provider: 'BOFA_MERCHANT',
      status: 'BLOCKED',
      corrected: false,
    });
    await expect(prisma.outboxEvent.count({ where: { aggregateId: payment.id } })).resolves.toBe(0);
  });

  test('full refund revokes only unused canonical entitlement and credit through append-only state', async () => {
    const { payment, purchase } = await paid('PAYPAL', 'full-refund');
    await requestRefund(prisma, registry, { paymentId: payment.id, amount: '100.00', actorId: userId, idempotencyKey: `${marker}-full-refund` });
    await expect(prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).resolves.toMatchObject({ state: 'REFUNDED', provider: 'PAYPAL' });
    await expect(prisma.servicePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: 'REFUNDED' });
    await expect(prisma.serviceEntitlement.findFirstOrThrow({ where: { purchaseId: purchase.id } })).resolves.toMatchObject({ status: 'CANCELLED' });
    const credits = await prisma.reviewCreditTransaction.findMany({ where: { purchaseId: purchase.id }, orderBy: { createdAt: 'asc' } });
    expect(credits.map(({ availableDelta }) => availableDelta)).toEqual([1, -1]);
  });

  test('failed provider refund leaves no financial effects and same-key retry converges once', async () => {
    const { payment, purchase } = await paid('PAYPAL', 'retry-refund');
    const key = `${marker}-retry-refund`;
    paypal.healthy = false;
    await expect(requestRefund(prisma, registry, { paymentId: payment.id, amount: '100.00', actorId: userId, idempotencyKey: key })).rejects.toThrow('TEST_PROVIDER_UNAVAILABLE');
    await expect(prisma.servicePurchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: 'PAID' });
    const failed = await prisma.paymentRefund.findUniqueOrThrow({ where: { paymentId_idempotencyKey: { paymentId: payment.id, idempotencyKey: key } } });
    await expect(prisma.outboxEvent.count({ where: { eventKey: `refund-succeeded:${failed.id}` } })).resolves.toBe(0);
    paypal.healthy = true;
    const retried = await requestRefund(prisma, registry, { paymentId: payment.id, amount: '100.00', actorId: userId, idempotencyKey: key });
    expect(retried.status).toBe('SUCCEEDED');
    await expect(prisma.paymentRefund.count({ where: { paymentId: payment.id } })).resolves.toBe(1);
    await expect(prisma.outboxEvent.count({ where: { eventKey: `refund-succeeded:${retried.id}` } })).resolves.toBe(1);
  });

  test('duplicate and reordered disputes are idempotent and monotonic', async () => {
    const { payment } = await paid('STRIPE', 'dispute');
    const base = {
      provider: 'STRIPE' as const,
      providerPaymentId: payment.providerPaymentId!,
      state: 'SUCCEEDED' as const,
      eventType: 'charge.dispute.updated',
      occurredAt: new Date(),
      dispute: {
        providerDisputeId: `${marker}-dp`,
        status: 'LOST' as const,
        amount: '25.00',
        currency: 'USD',
      },
    };
    await applyVerifiedPaymentEvent(prisma, { ...base, providerEventId: `${marker}-dp-lost` });
    await applyVerifiedPaymentEvent(prisma, {
      ...base,
      providerEventId: `${marker}-dp-old`,
      dispute: { ...base.dispute, status: 'OPEN' },
    });
    await expect(
      prisma.paymentDispute.findUniqueOrThrow({
        where: {
          provider_providerDisputeId: { provider: 'STRIPE', providerDisputeId: `${marker}-dp` },
        },
      }),
    ).resolves.toMatchObject({ status: 'LOST' });
    await expect(
      prisma.paymentDispute.count({ where: { providerDisputeId: `${marker}-dp` } }),
    ).resolves.toBe(1);
  });
});
