import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createCommerceRouter } from './routes.js';

const principal = (role: AuthPrincipal['role']): AuthPrincipal => ({
  userId: `00000000-0000-4000-8000-00000000000${role === 'CLIENT' ? 1 : role === 'CONSULTANT' ? 2 : 3}`,
  clientId: role === 'CLIENT' ? '00000000-0000-4000-8000-000000000010' : null,
  email: `${role.toLowerCase()}@example.test`,
  role,
  status: 'ACTIVE',
  staffMfaVerified: role !== 'CLIENT',
  stepUpVerified: role !== 'CLIENT',
});

function application(
  auth: AuthPrincipal,
  authorization: AuthorizationService,
  prisma: Partial<PrismaClient> = {},
) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = auth;
    next();
  });
  app.use('/api/v1', createCommerceRouter(prisma as PrismaClient, authorization));
  app.use(errorHandler(pino({ enabled: false })));
  return app;
}

describe('commerce route authorization and activation', () => {
  const denied: AuthorizationService = {
    authorizeCapability: async () => false,
    authorize: async () => false,
  };
  const allowed: AuthorizationService = {
    authorizeCapability: async () => true,
    authorize: async () => true,
  };

  test('denies client access to administration', async () => {
    await request(application(principal('CLIENT'), allowed))
      .get('/api/v1/admin/service-products')
      .expect(403);
  });

  test('denies a consultant outside client scope', async () => {
    await request(application(principal('CONSULTANT'), denied))
      .get('/api/v1/consultant/clients/00000000-0000-4000-8000-000000000099/services')
      .expect(403);
  });

  test('bounds, searches, and deterministically paginates client purchase history', async () => {
    const findMany = vi.fn(async () => [
      {
        id: '00000000-0000-4000-8000-000000000050',
        status: 'PAID',
        amount: new Prisma.Decimal('125.00'),
        currency: 'USD',
        purchasedAt: new Date('2026-09-01T00:00:00.000Z'),
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        termsSnapshot: { name: 'Strategy review', version: 1 },
        productVersion: null,
        entitlements: [],
        reviewCreditTransactions: [{ availableDelta: 2 }],
        payments: [],
      },
    ]);
    const prisma = {
      servicePurchase: { findMany, count: vi.fn(async () => 21) },
    } as unknown as PrismaClient;
    const response = await request(application(principal('CLIENT'), allowed, prisma))
      .get('/api/v1/client/services/history?search=strategy&status=PAID&page=2&pageSize=10')
      .expect(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(response.body).toMatchObject({ total: 21, page: 2, pageSize: 10, hasMore: true });
  });

  test('rejects activation when required terms are invalid', async () => {
    const prisma = {
      serviceProductVersion: {
        findUnique: async () => ({
          name: '',
          description: '',
          price: new Prisma.Decimal('-1'),
          currency: 'usd',
          entitlementType: null,
          includedQuantity: 0,
          includedReviewCredits: -1,
        }),
      },
    } as unknown as PrismaClient;
    const response = await request(application(principal('ADMIN'), allowed, prisma))
      .post('/api/v1/admin/service-products/00000000-0000-4000-8000-000000000099/activate')
      .set('Idempotency-Key', 'invalid-activation')
      .send({ version: 1 })
      .expect(409);
    expect(response.body.error.code).toBe('PRODUCT_ACTIVATION_BLOCKED');
  });
});
