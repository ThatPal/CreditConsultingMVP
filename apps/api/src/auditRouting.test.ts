import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from './app.js';
import type { AuthService } from './auth/authService.js';
import type { AuthPrincipal } from './auth/types.js';
import { loadEnv } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/credit_strategy_test',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:5185',
});

// Keep the real app/router ordering and canonical authorization. Only persistence
// and session resolution are stubbed; no database or review account is modified.
function application(role: AuthPrincipal['role'] | null, allowed = true, mfa = true) {
  const principal: AuthPrincipal | null = role && {
    userId: 'audit-user',
    clientId: role === 'CLIENT' ? 'own-client' : null,
    email: 'audit@example.test',
    role,
    status: 'ACTIVE',
    staffMfaEnabled: mfa,
    staffMfaVerified: mfa,
    stepUpVerified: mfa,
  };
  const delegate = () => ({
    count: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  });
  const db = {
    roleCapability: {
      findUnique: vi.fn().mockImplementation(async () => (allowed ? { id: 'capability' } : null)),
    },
    securityEvent: delegate(),
    payment: delegate(),
    paymentDispute: delegate(),
    aIJob: delegate(),
    cardCatalogCandidate: delegate(),
    integration: delegate(),
    serviceProduct: delegate(),
    outboxEvent: delegate(),
    workItem: delegate(),
    cardProduct: delegate(),
    cardOfferVersion: delegate(),
    $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
  };
  const auth = { authenticate: vi.fn().mockResolvedValue(principal) } as unknown as AuthService;
  return {
    app: createApp(
      env,
      pino({ level: 'silent' }),
      auth,
      undefined,
      undefined,
      db as unknown as PrismaClient,
    ),
    db,
  };
}

describe('APC assembled application routing regressions', () => {
  test('Admin operations survive strategy router composition', async () => {
    const { app } = application('ADMIN');
    await request(app).get('/api/v1/admin/dashboard').expect(200);
    await request(app).get('/api/v1/admin/payments').expect(200);
    await request(app).post('/api/v1/admin/strategies/example/approve').expect(403);
    await request(app).post('/api/v1/admin/clients/example/strategies/example/approve').expect(403);
    await request(app)
      .post('/api/v1/consultant/clients/example/strategies/example/approve')
      .expect(403);
  });

  test.each(['CLIENT', 'CONSULTANT'] as const)('denies %s Admin payment access', async (role) => {
    await request(application(role).app).get('/api/v1/admin/payments').expect(403);
  });

  test('Work Queue uses the versioned app mount and preserves role denial', async () => {
    const { app, db } = application('CONSULTANT');
    const response = await request(app).get('/api/v1/consultant/work-queue').expect(200);
    expect(response.body.items).toEqual([]);
    // A missing item proves the claim handler is reached, without a mutation.
    await request(app)
      .post('/api/v1/consultant/work-queue/example/claim')
      .send({ expectedVersion: 1 })
      .expect(404);
    expect(db.workItem.findUnique).toHaveBeenCalledWith({ where: { id: 'example' } });
    await request(application('CLIENT').app).get('/api/v1/consultant/work-queue').expect(403);
  });

  test.each(['CLIENT', 'CONSULTANT', 'ADMIN'] as const)(
    'permits %s canonical catalog reads',
    async (role) => {
      const { app, db } = application(role);
      await request(app).get('/api/v1/cards/catalog').expect(200, { products: [] });
      await request(app).get('/api/v1/cards/catalog/example/offers').expect(200, { offers: [] });
      expect(db.roleCapability.findUnique).toHaveBeenCalledWith({
        where: { role_capability: { role, capability: 'catalog.read' } },
        select: { id: true },
      });
      // Shared catalog access must not grant client-specific access.
      await request(app).get('/api/v1/consultant/clients/other/cards').expect(403);
    },
  );

  test.each(['/api/v1/cards/catalog', '/api/v1/cards/catalog/example/offers'])(
    'fails closed for %s',
    async (path) => {
      await request(application(null).app).get(path).expect(401);
      await request(application('CLIENT', false).app).get(path).expect(403);
      await request(application('CONSULTANT', true, false).app)
        .get(path)
        .expect(403);
      const { app, db } = application('CLIENT');
      db.roleCapability.findUnique.mockRejectedValueOnce(new Error('lookup unavailable'));
      await request(app).get(path).expect(403);
      expect(db.cardProduct.findMany).not.toHaveBeenCalled();
      expect(db.cardOfferVersion.findMany).not.toHaveBeenCalled();
    },
  );
});
