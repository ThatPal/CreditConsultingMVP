import { randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import { createPrismaAuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import { seedSystemReferenceData } from '../seeding/systemSeed.js';
import { createClientContextRouter } from './routes.js';

describe('client and relationship context', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const suite = `sprint41-${randomUUID()}`;
  let prisma: PrismaClient;
  let consultant: { id: string; email: string };
  let outsider: { id: string; email: string };
  const clients: Array<{ id: string; userId: string; email: string }> = [];

  const principal = (identity: string): AuthPrincipal | undefined => {
    const client = clients.find((item) => item.email === identity);
    if (client)
      return {
        userId: client.userId,
        clientId: client.id,
        email: client.email,
        role: 'CLIENT',
        status: 'ACTIVE',
      };
    const staff =
      identity === 'consultant' ? consultant : identity === 'outsider' ? outsider : undefined;
    return staff
      ? {
          userId: staff.id,
          clientId: null,
          email: staff.email,
          role: 'CONSULTANT',
          status: 'ACTIVE',
          staffMfaEnabled: true,
          staffMfaVerified: true,
          stepUpVerified: true,
        }
      : undefined;
  };
  const app = () => {
    const application = express();
    application.use(express.json());
    application.use((req, _res, next) => {
      req.auth = principal(req.get('x-test-identity') ?? '');
      next();
    });
    application.use(
      '/api/v1',
      createClientContextRouter(prisma, createPrismaAuthorizationService(prisma)),
    );
    application.use(errorHandler(pino({ enabled: false })));
    return application;
  };

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    await seedSystemReferenceData(prisma);
    consultant = await prisma.user.create({
      data: { email: `${suite}-consultant@example.test`, role: 'CONSULTANT' },
      select: { id: true, email: true },
    });
    outsider = await prisma.user.create({
      data: { email: `${suite}-outsider@example.test`, role: 'CONSULTANT' },
      select: { id: true, email: true },
    });
    for (const [firstName, lastName] of [
      ['Personal', 'Same'],
      ['Many', 'Same'],
      ['Expired', 'Same'],
      ['Revoked', 'Same'],
    ]) {
      const user = await prisma.user.create({
        data: {
          email: `${suite}-${firstName!.toLowerCase()}@example.test`,
          role: 'CLIENT',
          client: {
            create: { firstName: firstName!, lastName: lastName!, termsAcceptedAt: new Date() },
          },
        },
        include: { client: true },
      });
      clients.push({ id: user.client!.id, userId: user.id, email: user.email });
    }
    await prisma.staffClientAssignment.createMany({
      data: clients
        .slice(0, 2)
        .map((client) => ({ staffUserId: consultant.id, clientId: client.id })),
    });
    await prisma.clientAccessGrant.createMany({
      data: [
        {
          granteeId: consultant.id,
          clientId: clients[2]!.id,
          scope: 'READ',
          allowedCapabilities: ['client.read'],
          reason: suite,
          startsAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() - 3600000),
          grantorId: outsider.id,
        },
        {
          granteeId: consultant.id,
          clientId: clients[3]!.id,
          scope: 'READ',
          allowedCapabilities: ['client.read'],
          reason: suite,
          startsAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() + 3600000),
          revokedAt: new Date(),
          grantorId: outsider.id,
          revokerId: outsider.id,
        },
      ],
    });
  });

  afterAll(async () => {
    const clientIds = clients.map((item) => item.id);
    const userIds = [...clients.map((item) => item.userId), consultant.id, outsider.id];
    const businessIds = (
      await prisma.clientBusiness.findMany({
        where: { clientId: { in: clientIds } },
        select: { id: true },
      })
    ).map((item) => item.id);
    await prisma.outboxEvent.deleteMany({
      where: { OR: [{ aggregateId: { in: clientIds } }, { aggregateId: { in: businessIds } }] },
    });
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { clientId: { in: clientIds } }] },
    });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: { in: clientIds } } });
    await prisma.clientBusiness.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  test('supports a personal-only zero state and duplicate-safe business creation', async () => {
    const identity = clients[0]!.email;
    await request(app())
      .get('/api/v1/client/context')
      .set('x-test-identity', identity)
      .expect(200)
      .expect(({ body }) => expect(body.context.businesses).toEqual([]));
    const key = randomUUID();
    const body = { legalName: 'Canonical Consulting LLC', entityType: 'LLC' };
    await request(app())
      .post('/api/v1/client/businesses')
      .set('x-test-identity', identity)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(201);
    await request(app())
      .post('/api/v1/client/businesses')
      .set('x-test-identity', identity)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(200)
      .expect(({ body }) => expect(body.replayed).toBe(true));
    expect(await prisma.clientBusiness.count({ where: { clientId: clients[0]!.id } })).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { clientId: clients[0]!.id, action: 'CLIENT_BUSINESS_CREATED' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          eventType: 'client.business.created',
          payload: { path: ['clientId'], equals: clients[0]!.id },
        },
      }),
    ).toBe(1);
  });

  test('allows multiple businesses but rejects secret-shaped or cross-client relationship input', async () => {
    const identity = clients[1]!.email;
    for (const legalName of ['One LLC', 'Two Inc'])
      await request(app())
        .post('/api/v1/client/businesses')
        .set('x-test-identity', identity)
        .set('Idempotency-Key', randomUUID())
        .send({ legalName })
        .expect(201);
    expect(await prisma.clientBusiness.count({ where: { clientId: clients[1]!.id } })).toBe(2);
    await request(app())
      .post('/api/v1/client/financial-relationships')
      .set('x-test-identity', identity)
      .set('Idempotency-Key', randomUUID())
      .send({
        institutionName: 'Safe Bank',
        relationshipType: 'CHECKING',
        accountNumber: 'never-store',
      })
      .expect(400);
    const otherBusiness = await prisma.clientBusiness.findFirstOrThrow({
      where: { clientId: clients[0]!.id },
    });
    await request(app())
      .post('/api/v1/client/financial-relationships')
      .set('x-test-identity', identity)
      .set('Idempotency-Key', randomUUID())
      .send({
        institutionName: 'Safe Bank',
        relationshipType: 'CHECKING',
        clientBusinessId: otherBusiness.id,
      })
      .expect(400);
  });

  test('paginates deterministically and excludes expired, revoked, and unauthorized clients', async () => {
    const first = await request(app())
      .get('/api/v1/consultant/client-context?page=1&pageSize=1')
      .set('x-test-identity', 'consultant')
      .expect(200);
    const second = await request(app())
      .get('/api/v1/consultant/client-context?page=2&pageSize=1')
      .set('x-test-identity', 'consultant')
      .expect(200);
    expect(first.body.total).toBe(2);
    expect(new Set([first.body.clients[0].id, second.body.clients[0].id]).size).toBe(2);
    expect([first.body.clients[0].id, second.body.clients[0].id].sort()).toEqual(
      clients
        .slice(0, 2)
        .map((item) => item.id)
        .sort(),
    );
    await request(app())
      .get(`/api/v1/consultant/client-context/${clients[0]!.id}`)
      .set('x-test-identity', 'outsider')
      .expect(403);
  });
});
