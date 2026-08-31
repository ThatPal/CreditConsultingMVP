import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import type { EmailProvider } from './emailProvider.js';
import { createIntegrationRouter, createNotificationRouter } from './routes.js';

describe('notification and integration routes', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const suite = `sprint33-routes-${randomUUID()}`;
  let prisma: PrismaClient;
  let one: { userId: string; clientId: string };
  let two: { userId: string; clientId: string };
  let adminId: string;
  let notificationId: string;
  let integrationId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    const createClient = async (label: string) => {
      const user = await prisma.user.create({
        data: {
          email: `${suite}-${label}@example.test`,
          role: 'CLIENT',
          client: { create: { firstName: label, lastName: suite, termsAcceptedAt: new Date() } },
        },
        include: { client: true },
      });
      return { userId: user.id, clientId: user.client!.id };
    };
    one = await createClient('one');
    two = await createClient('two');
    adminId = (
      await prisma.user.create({ data: { email: `${suite}-admin@example.test`, role: 'ADMIN' } })
    ).id;
    notificationId = (
      await prisma.notification.create({
        data: {
          userId: one.userId,
          clientId: one.clientId,
          semanticKey: `${suite}:own`,
          type: 'TEST',
          title: 'Safe update',
          body: 'A safe account update is available.',
          link: '/app/account',
        },
      })
    ).id;
    integrationId = (
      await prisma.integration.create({
        data: {
          key: suite,
          type: 'EMAIL',
          provider: 'SMTP',
          enabled: true,
          configurationMetadata: {
            host: 'smtp-relay.gmail.com',
            port: 587,
            password: 'incorrectly-stored-defense-in-depth',
          },
          secretReferences: ['secret://email/private-password'],
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorId: adminId } });
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: [one.userId, two.userId] } },
    });
    await prisma.notification.deleteMany({ where: { userId: { in: [one.userId, two.userId] } } });
    await prisma.integration.delete({ where: { id: integrationId } });
    await prisma.client.deleteMany({ where: { id: { in: [one.clientId, two.clientId] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: suite } } });
    await prisma.$disconnect();
  });

  function app() {
    const application = express();
    application.use(express.json());
    application.use((req, _res, next) => {
      const identity = req.get('x-test-identity');
      if (identity === 'one')
        req.auth = {
          userId: one.userId,
          clientId: one.clientId,
          email: `${suite}-one@example.test`,
          role: 'CLIENT',
          status: 'ACTIVE',
        };
      if (identity === 'two')
        req.auth = {
          userId: two.userId,
          clientId: two.clientId,
          email: `${suite}-two@example.test`,
          role: 'CLIENT',
          status: 'ACTIVE',
        };
      if (identity === 'admin')
        req.auth = {
          userId: adminId,
          clientId: null,
          email: `${suite}-admin@example.test`,
          role: 'ADMIN',
          status: 'ACTIVE',
          staffMfaVerified: true,
          stepUpVerified: true,
        };
      next();
    });
    const authorization: AuthorizationService = {
      authorize: async (principal, capability, resource, options) =>
        principal.role === 'ADMIN' &&
        capability === 'settings.manage' &&
        resource.type === 'platform' &&
        Boolean(options?.requireStepUp && principal.stepUpVerified),
    };
    const provider: EmailProvider = {
      name: 'SMTP',
      send: vi.fn(),
      testConnection: vi.fn(async () => {
        throw new Error('secret raw provider response');
      }),
    };
    application.use('/notifications', createNotificationRouter(prisma));
    application.use('/integrations', createIntegrationRouter(prisma, authorization, provider));
    application.use(errorHandler(pino({ enabled: false })));
    return application;
  }

  test('lists and marks only the authenticated user notifications idempotently', async () => {
    await request(app())
      .get('/notifications')
      .set('x-test-identity', 'one')
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ unread: 1, notifications: [{ id: notificationId }] }),
      );
    await request(app())
      .patch(`/notifications/${notificationId}/read`)
      .set('x-test-identity', 'two')
      .expect(404);
    const firstRead = await request(app())
      .patch(`/notifications/${notificationId}/read`)
      .set('x-test-identity', 'one')
      .expect(200);
    const repeatedRead = await request(app())
      .patch(`/notifications/${notificationId}/read`)
      .set('x-test-identity', 'one')
      .expect(200);
    expect(repeatedRead.body.notification.readAt).toBe(firstRead.body.notification.readAt);
    await request(app()).post('/notifications/read-all').set('x-test-identity', 'one').expect(204);
  });

  test('preserves required in-app preferences', async () => {
    await request(app())
      .put('/notifications/preferences/current')
      .set('x-test-identity', 'one')
      .send({ category: 'SECURITY', channel: 'IN_APP', enabled: false })
      .expect(409);
    await request(app())
      .put('/notifications/preferences/current')
      .set('x-test-identity', 'one')
      .send({ category: 'SUPPORT', channel: 'EMAIL', enabled: false })
      .expect(200);
  });

  test('protects integration health and redacts secret references and provider failures', async () => {
    await request(app()).get('/integrations').set('x-test-identity', 'one').expect(404);
    const listed = await request(app())
      .get('/integrations')
      .set('x-test-identity', 'admin')
      .expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('private-password');
    expect(JSON.stringify(listed.body)).not.toContain('incorrectly-stored-defense-in-depth');
    const tested = await request(app())
      .post(`/integrations/${integrationId}/test-connection`)
      .set('x-test-identity', 'admin')
      .send({ password: 'must-not-persist' })
      .expect(503);
    expect(tested.body.integration).toMatchObject({
      status: 'FAILED',
      lastErrorCategory: 'PROVIDER_UNAVAILABLE',
    });
    expect(JSON.stringify(tested.body)).not.toContain('secret raw provider response');
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { actorId: adminId, action: 'INTEGRATION_CONNECTION_TESTED' },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain('must-not-persist');
    expect(JSON.stringify(audit.metadata)).not.toContain('secret raw provider response');
  });
});
