import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import { DeterministicPaymentGateway } from './paymentGateway.js';
import { createPaymentRouter } from './paymentRoutes.js';

describe('payment route boundaries', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `sprint52-routes-${randomUUID()}`;
  const gateway = new DeterministicPaymentGateway();
  const authorization: AuthorizationService = {
    authorizeCapability: async () => false,
    authorize: async () => false,
  };
  let prisma: PrismaClient;
  let productId: string;
  let client: AuthPrincipal;
  let otherClient: AuthPrincipal;
  const app = (principal?: AuthPrincipal) => {
    const application = express();
    application.use(express.json());
    if (principal)
      application.use((req, _res, next) => {
        req.auth = principal;
        next();
      });
    application.use(
      '/api/v1',
      createPaymentRouter(prisma, authorization, gateway, 'http://credit.test'),
    );
    application.use(errorHandler(pino({ enabled: false })));
    return application;
  };
  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const createClient = async (suffix: string) => {
      const user = await prisma.user.create({
        data: {
          email: `${marker}-${suffix}@example.test`,
          role: 'CLIENT',
          client: {
            create: { firstName: suffix, lastName: 'Client', termsAcceptedAt: new Date() },
          },
        },
        include: { client: true },
      });
      return {
        userId: user.id,
        clientId: user.client!.id,
        email: user.email,
        role: 'CLIENT',
        status: 'ACTIVE',
      } as const;
    };
    client = await createClient('owner');
    otherClient = await createClient('other');
    const product = await prisma.serviceProduct.create({
      data: {
        key: marker.toUpperCase().replaceAll('-', '_'),
        active: true,
        currentVersion: 1,
        versions: {
          create: {
            version: 1,
            status: 'ACTIVE',
            name: 'Canonical price',
            description: 'Server governed',
            price: '41.00',
            currency: 'USD',
            entitlementType: 'CREDIT_PROFILE_REVIEW',
            includedQuantity: 1,
            includedReviewCredits: 1,
          },
        },
      },
    });
    productId = product.id;
  });
  afterAll(async () => {
    const clientIds = [client.clientId!, otherClient.clientId!];
    const purchases = await prisma.servicePurchase.findMany({
      where: { clientId: { in: clientIds } },
      select: { id: true },
    });
    const ids = purchases.map(({ id }) => id);
    await prisma.paymentProviderEvent.deleteMany({
      where: { payment: { clientId: { in: clientIds } } },
    });
    await prisma.payment.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
    await prisma.auditEvent.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: { in: clientIds } } });
    await prisma.servicePurchase.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceProductVersion.deleteMany({ where: { serviceProductId: productId } });
    await prisma.serviceProduct.delete({ where: { id: productId } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: marker } } });
    await prisma.$disconnect();
  });
  test('duplicate checkout key creates one canonical purchase and ignores caller pricing authority', async () => {
    const key = `${marker}-same-click`;
    const first = await request(app(client))
      .post('/api/v1/client/checkouts')
      .set('Idempotency-Key', key)
      .send({ productId })
      .expect(201);
    const replay = await request(app(client))
      .post('/api/v1/client/checkouts')
      .set('Idempotency-Key', key)
      .send({ productId })
      .expect(200);
    expect(replay.body.purchaseId).toBe(first.body.purchaseId);
    expect(replay.body.replayed).toBe(true);
    await expect(
      prisma.servicePurchase.count({ where: { id: first.body.purchaseId } }),
    ).resolves.toBe(1);
    await expect(
      prisma.payment.count({ where: { purchaseId: first.body.purchaseId } }),
    ).resolves.toBe(1);
    const purchase = await prisma.servicePurchase.findUniqueOrThrow({
      where: { id: first.body.purchaseId },
    });
    expect(purchase.amount.toFixed(2)).toBe('41.00');
    expect(purchase.currency).toBe('USD');
    await request(app(client))
      .post('/api/v1/client/checkouts')
      .set('Idempotency-Key', `${key}-tamper`)
      .send({ productId, amount: '0.01', currency: 'XXX', clientId: otherClient.clientId })
      .expect(400);
  });
  test('client IDOR, missing session, and admin capability denial fail closed', async () => {
    const purchase = await prisma.servicePurchase.findFirstOrThrow({
      where: { clientId: client.clientId! },
    });
    await request(app(otherClient)).get(`/api/v1/client/checkouts/${purchase.id}`).expect(404);
    await request(app()).get(`/api/v1/client/checkouts/${purchase.id}`).expect(401);
    const admin = {
      ...client,
      role: 'ADMIN' as const,
      clientId: null,
      staffMfaVerified: true,
      stepUpVerified: true,
    };
    await request(app(admin)).get('/api/v1/admin/payments').expect(403);
  });
});
