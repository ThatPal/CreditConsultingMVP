import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createAdminOperationsRouter, redactMetadata } from './routes.js';

const principal = (role: 'ADMIN' | 'CONSULTANT', stepUpVerified = true): AuthPrincipal => ({
  userId: crypto.randomUUID(),
  clientId: null,
  email: `${role.toLowerCase()}@test.local`,
  role,
  status: 'ACTIVE',
  staffMfaEnabled: true,
  staffMfaVerified: true,
  stepUpVerified,
});

function application(role: 'ADMIN' | 'CONSULTANT', stepUpVerified = true) {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: 'u1',
      email: 'person@credit.local',
      name: 'Person',
      role: 'CLIENT',
      status: 'ACTIVE',
      twoFactorEnabled: false,
      lastLoginAt: null,
      updatedAt: new Date(),
      _count: { betterAuthSessions: 0, accessGrants: 0, staffAssignments: 0 },
    },
  ]);
  const prisma = {
    $transaction: vi.fn(async (values: Promise<unknown>[]) => Promise.all(values)),
    user: { count: vi.fn().mockResolvedValue(1), findMany },
  } as unknown as PrismaClient;
  const authz = {
    authorizeCapability: vi.fn(
      async (p: AuthPrincipal, _c: string, o?: { requireStepUp?: boolean }) =>
        p.role === 'ADMIN' && (!o?.requireStepUp || p.stepUpVerified),
    ),
  } as unknown as AuthorizationService;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.auth = principal(role, stepUpVerified);
    next();
  });
  app.use('/api/v1/admin', createAdminOperationsRouter(prisma, authz));
  app.use(errorHandler(pino({ enabled: false })));
  return { app, findMany };
}

describe('ADMIN-02 identity administration', () => {
  test('recursively redacts sensitive event metadata', () => {
    expect(redactMetadata({ token: 'no', nested: { passwordHash: 'no', reason: 'safe' } })).toEqual(
      {
        token: '[REDACTED]',
        nested: { passwordHash: '[REDACTED]', reason: 'safe' },
      },
    );
  });
  test('denies Consultant access even when capability service is permissive', async () => {
    await request(application('CONSULTANT').app).get('/api/v1/admin/users').expect(403);
  });
  test('uses bounded deterministic directory ordering', async () => {
    const { app, findMany } = application('ADMIN');
    const response = await request(app)
      .get('/api/v1/admin/users?page=1&pageSize=20&search=person')
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ role: 'asc' }, { email: 'asc' }, { id: 'asc' }],
        take: 20,
        skip: 0,
      }),
    );
  });
  test('requires step-up before consequential role changes', async () => {
    await request(application('ADMIN', false).app)
      .patch(`/api/v1/admin/users/${crypto.randomUUID()}/role`)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ role: 'CONSULTANT', expectedUpdatedAt: new Date().toISOString() })
      .expect(403);
  });
});
