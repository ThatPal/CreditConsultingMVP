import { createHmac, randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import {
  BankOfAmericaGateway,
  DeterministicPaymentGateway,
  PaymentGatewayRegistry,
} from './paymentGateway.js';
import { createPaymentWebhookRouter } from './paymentRoutes.js';

describe('Bank of America hosted merchant notification boundary', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint54-${randomUUID()}`;
  const secretKey = 'sprint54-integration-secret';
  let prisma: PrismaClient;
  let clientId: string;
  let userId: string;
  let productId: string;
  let purchaseId: string;
  let paymentId: string;
  const sign = (fields: Record<string, string>) => {
    const data = fields
      .signed_field_names!.split(',')
      .map((name) => `${name}=${fields[name] ?? ''}`)
      .join(',');
    return createHmac('sha256', secretKey).update(data).digest('base64');
  };
  const app = () => {
    const application = express();
    application.use(
      '/api/v1/webhooks',
      createPaymentWebhookRouter(
        prisma,
        new PaymentGatewayRegistry(
          [
            new DeterministicPaymentGateway(),
            new BankOfAmericaGateway({
              accessKey: 'sprint54-access',
              profileId: 'sprint54-profile',
              secretKey,
            }),
          ],
          'BOFA_MERCHANT',
        ),
      ),
    );
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
        client: { create: { firstName: 'BofA', lastName: 'Proof', termsAcceptedAt: new Date() } },
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
            name: 'BofA canonical proof',
            description: 'Frozen hosted effects',
            price: '43.00',
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
        termsSnapshot: { name: 'Frozen BofA proof' },
        amount: '43.00',
        currency: 'USD',
        paymentProvider: 'BOFA_MERCHANT',
      },
    });
    purchaseId = purchase.id;
    const payment = await prisma.payment.create({
      data: {
        clientId,
        purchaseId,
        provider: 'BOFA_MERCHANT',
        providerEnvironment: 'SANDBOX',
        providerOrderId: `${marker}-transaction`,
        state: 'AWAITING_CUSTOMER',
        amount: '43.00',
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
      where: { OR: [{ clientId }, { source: 'BOFA_MERCHANT_WEBHOOK' }] },
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
  test('forgery grants nothing; signed duplicate notification grants frozen effects once', async () => {
    const fields: Record<string, string> = {
      transaction_uuid: `${marker}-transaction`,
      decision: 'ACCEPT',
      request_id: `${marker}-request`,
      reason_code: '100',
      signed_field_names: 'transaction_uuid,decision,request_id,reason_code,signed_field_names',
    };
    await request(app())
      .post('/api/v1/webhooks/bofa')
      .type('form')
      .send({ ...fields, signature: 'forged' })
      .expect(401);
    await expect(prisma.serviceEntitlement.count({ where: { purchaseId } })).resolves.toBe(0);
    await expect(prisma.reviewCreditTransaction.count({ where: { purchaseId } })).resolves.toBe(0);

    const signed = { ...fields, signature: sign(fields) };
    await request(app()).post('/api/v1/webhooks/bofa').type('form').send(signed).expect(202);
    await request(app()).post('/api/v1/webhooks/bofa').type('form').send(signed).expect(202);
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
        where: { provider: 'BOFA_MERCHANT', providerEventId: `${marker}-request` },
      }),
    ).resolves.toBe(1);
  });
});
