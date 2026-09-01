import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import {
  DeterministicPaymentGateway,
  PaymentGatewayRegistry,
  StripeGateway,
} from './paymentGateway.js';
import { createPaymentWebhookRouter } from './paymentRoutes.js';

describe('Stripe authoritative webhook boundary', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint53-${randomUUID()}`;
  const webhookSecret = 'whsec_sprint53_integration_only';
  let prisma: PrismaClient;
  let clientId: string;
  let userId: string;
  let purchaseId: string;
  let paymentId: string;
  let productId: string;
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = (eventId: string) =>
    JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'checkout.session.completed',
      created: timestamp,
      data: {
        object: {
          id: `${marker}-session`,
          object: 'checkout.session',
          created: timestamp,
          status: 'complete',
          payment_status: 'paid',
          payment_intent: `${marker}-intent`,
        },
      },
    });
  const app = () => {
    const application = express();
    const registry = new PaymentGatewayRegistry(
      [
        new DeterministicPaymentGateway(),
        new StripeGateway({ secretKey: 'sk_test_not_real', webhookSecret }),
      ],
      'STRIPE',
    );
    application.use('/api/v1/webhooks', createPaymentWebhookRouter(prisma, registry));
    application.use(errorHandler(pino({ enabled: false })));
    return application;
  };
  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `${marker}@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: 'Stripe', lastName: 'Proof', termsAcceptedAt: new Date() } },
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
            name: 'Stripe canonical proof',
            description: 'Frozen provider-neutral effects',
            price: '37.00',
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
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId,
        productVersionId: product.versions[0]!.id,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        termsSnapshot: { name: 'Frozen Stripe proof' },
        amount: '37.00',
        currency: 'USD',
        paymentProvider: 'STRIPE',
      },
    });
    purchaseId = purchase.id;
    const payment = await prisma.payment.create({
      data: {
        clientId,
        purchaseId,
        provider: 'STRIPE',
        providerEnvironment: 'TEST',
        providerOrderId: `${marker}-session`,
        state: 'PROCESSING',
        amount: '37.00',
        currency: 'USD',
      },
    });
    paymentId = payment.id;
  });
  afterAll(async () => {
    await prisma.paymentProviderEvent.deleteMany({ where: { paymentId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.reviewCreditTransaction.deleteMany({ where: { purchaseId } });
    await prisma.serviceEntitlement.deleteMany({ where: { purchaseId } });
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ clientId }, { source: 'STRIPE_WEBHOOK' }] },
    });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: purchaseId } });
    await prisma.payment.delete({ where: { id: paymentId } });
    await prisma.servicePurchase.delete({ where: { id: purchaseId } });
    await prisma.serviceProductVersion.deleteMany({ where: { serviceProductId: productId } });
    await prisma.serviceProduct.delete({ where: { id: productId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });
  test('forgery grants nothing; verified duplicate delivery grants frozen effects once', async () => {
    const body = payload(`${marker}-event`);
    await request(app())
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${timestamp},v1=forged`)
      .send(body)
      .expect(401);
    await expect(prisma.serviceEntitlement.count({ where: { purchaseId } })).resolves.toBe(0);
    await expect(prisma.reviewCreditTransaction.count({ where: { purchaseId } })).resolves.toBe(0);
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(0);

    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret,
      timestamp,
    });
    await request(app())
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(body)
      .expect(202);
    await request(app())
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(body)
      .expect(202);

    await expect(prisma.serviceEntitlement.count({ where: { purchaseId } })).resolves.toBe(1);
    await expect(prisma.reviewCreditTransaction.count({ where: { purchaseId } })).resolves.toBe(1);
    await expect(
      prisma.notification.count({ where: { semanticKey: `purchase-paid:${purchaseId}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { entityId: paymentId, action: 'PAYMENT_SUCCEEDED_AND_EFFECTS_GRANTED' },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `purchase-paid:${purchaseId}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.paymentProviderEvent.count({
        where: { provider: 'STRIPE', providerEventId: `${marker}-event` },
      }),
    ).resolves.toBe(1);
  });
});
