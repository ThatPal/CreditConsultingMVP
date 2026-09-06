import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createCardRouter } from './routes.js';

function application(allowed: boolean) {
  const prisma = {
    cardCatalogCandidate: { findMany: vi.fn().mockResolvedValue([]) },
    cardInsightVersion: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient;
  const authorization = {
    authorizeCapability: vi.fn().mockResolvedValue(allowed),
    authorize: vi.fn().mockRejectedValue(new Error('client-scoped authorization must not run')),
  } as unknown as AuthorizationService;
  const app = express();
  app.use((req, _res, next) => {
    req.auth = {
      userId: crypto.randomUUID(),
      clientId: null,
      email: 'admin@credit.local',
      role: 'ADMIN',
      status: 'ACTIVE',
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    };
    next();
  });
  app.use('/api/v1', createCardRouter(prisma, authorization));
  app.use(errorHandler(pino({ enabled: false })));
  return { app, authorization };
}

describe('platform card operations authorization', () => {
  test.each(['/api/v1/catalog/candidates', '/api/v1/catalog/insights'])(
    'uses canonical platform capability authorization for %s',
    async (path) => {
      const { app, authorization } = application(true);
      await request(app).get(path).expect(200);
      expect(authorization.authorizeCapability).toHaveBeenCalled();
      expect(authorization.authorize).not.toHaveBeenCalled();
    },
  );

  test('fails closed when the canonical capability is denied', async () => {
    await request(application(false).app).get('/api/v1/catalog/candidates').expect(403);
  });
});
