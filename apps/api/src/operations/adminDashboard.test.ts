import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import type { AuthService } from '../auth/authService.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createOperationsRouter } from './routes.js';

const principal = (role: 'ADMIN' | 'CONSULTANT'): AuthPrincipal => ({
  userId: crypto.randomUUID(),
  clientId: null,
  email: `${role.toLowerCase()}@example.test`,
  role,
  status: 'ACTIVE',
  staffMfaEnabled: true,
  staffMfaVerified: true,
  stepUpVerified: true,
});

function application(role: 'ADMIN' | 'CONSULTANT', failIntegrations = false) {
  const count = (value: number) => vi.fn().mockResolvedValue(value);
  const prisma = {
    payment: { count: count(2) },
    paymentDispute: { count: count(1) },
    aIJob: { count: count(3) },
    cardCatalogCandidate: { count: count(4) },
    integration: {
      count: failIntegrations ? vi.fn().mockRejectedValue(new Error('provider unavailable')) : count(5),
    },
    securityEvent: { count: count(6) },
    serviceProduct: { count: count(7) },
    outboxEvent: { count: count(8) },
  } as unknown as PrismaClient;
  const app = express();
  app.use((req, _res, next) => {
    req.auth = principal(role);
    next();
  });
  app.use(
    '/api/v1',
    createOperationsRouter(
      prisma,
      {} as AuthService,
      {},
      { authorize: vi.fn().mockResolvedValue(true) } as unknown as AuthorizationService,
      { record: vi.fn() },
    ),
  );
  app.use(errorHandler(pino({ enabled: false })));
  return app;
}

describe('ADMIN-01 operational dashboard', () => {
  test('composes canonical module metrics without creating operational work', async () => {
    const response = await request(application('ADMIN')).get('/api/v1/admin/dashboard').expect(200);
    expect(response.body.sections).toMatchObject({
      commerce: { status: 'healthy', pending: 2, failed: 2, disputes: 1 },
      ai: { status: 'healthy', queued: 3, failed: 3 },
      catalog: { status: 'healthy', pending: 4, conflicts: 4 },
      scheduledJobs: { status: 'unavailable' },
      platform: { status: 'healthy', pendingOutbox: 8, failedOutbox: 8 },
    });
  });

  test('degrades one unavailable module without blanking healthy sections', async () => {
    const response = await request(application('ADMIN', true))
      .get('/api/v1/admin/dashboard')
      .expect(200);
    expect(response.body.sections.integrations).toEqual({
      status: 'degraded',
      href: '/admin/integrations',
    });
    expect(response.body.sections.commerce.status).toBe('healthy');
  });

  test('denies non-admin staff', async () => {
    await request(application('CONSULTANT')).get('/api/v1/admin/dashboard').expect(403);
  });
});
