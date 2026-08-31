import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import { requireCapability } from '../auth/middleware.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import { seedSystemReferenceData } from '../seeding/systemSeed.js';
import { createAccessAdministration } from './accessAdministration.js';
import {
  createPrismaAuthorizationDenialRecorder,
  createPrismaAuthorizationService,
  createRealtimeAuthorizationBridge,
  type AuthorizationService,
} from './authorizationService.js';

const databaseUrl = process.env.DATABASE_URL;
let prisma: PrismaClient;
const principals = new Map<string, AuthPrincipal>();
const createdUserIds: string[] = [];

function appFor(authorization: AuthorizationService) {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = principals.get(req.get('x-test-principal') ?? '');
    next();
  });
  app.get(
    '/clients/:clientId/support',
    requireCapability(
      authorization,
      'support.manage',
      'clientId',
      undefined,
      createPrismaAuthorizationDenialRecorder(prisma),
    ),
    (_req, res) => res.json({ ok: true }),
  );
  app.use(errorHandler(pino({ level: 'silent' })));
  return app;
}

async function staff(role: 'CONSULTANT' | 'ADMIN', label: string) {
  const user = await prisma.user.create({
    data: { email: `${label}-${crypto.randomUUID()}@example.com`, role, status: 'ACTIVE' },
  });
  createdUserIds.push(user.id);
  return user;
}

async function client(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@example.com`,
      role: 'CLIENT',
      status: 'ACTIVE',
    },
  });
  createdUserIds.push(user.id);
  return prisma.client.create({
    data: { userId: user.id, firstName: label, lastName: 'Client', termsAcceptedAt: new Date() },
  });
}

function principal(user: { id: string; email: string; role: 'CONSULTANT' | 'ADMIN' }, key: string) {
  principals.set(key, {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: 'ACTIVE',
    clientId: null,
    staffMfaEnabled: true,
    staffMfaVerified: true,
    stepUpVerified: true,
  });
  return key;
}

beforeAll(async () => {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  prisma = createPrisma(databaseUrl);
  await prisma.$connect();
  await seedSystemReferenceData(prisma);
});

afterAll(async () => {
  await prisma.client.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.sequential('canonical Prisma authorization through HTTP', () => {
  test('enforces MFA, assignment isolation, immediate deactivation, and realtime parity', async () => {
    const consultant = await staff('CONSULTANT', 'canonical-assigned');
    const assigned = await client('assigned');
    const other = await client('other');
    const assignment = await prisma.staffClientAssignment.create({
      data: { staffUserId: consultant.id, clientId: assigned.id },
    });
    const key = principal(consultant, 'verified-consultant');
    const unverified = { ...principals.get(key)!, staffMfaVerified: false, stepUpVerified: false };
    principals.set('unverified-consultant', unverified);
    const authorization = createPrismaAuthorizationService(prisma);
    const app = appFor(authorization);

    await request(app)
      .get(`/clients/${assigned.id}/support`)
      .set('x-test-principal', 'unverified-consultant')
      .set('x-staff-mfa-verified', 'true')
      .expect(403);
    await request(app)
      .get(`/clients/${assigned.id}/support`)
      .set('x-test-principal', key)
      .expect(200);
    await request(app).get(`/clients/${other.id}/support`).set('x-test-principal', key).expect(403);

    const realtime = createRealtimeAuthorizationBridge(authorization);
    await expect(realtime.canSubscribeToClient(principals.get(key)!, assigned.id)).resolves.toBe(
      true,
    );
    const admin = await staff('ADMIN', 'assignment-admin');
    const command = createAccessAdministration(prisma);
    const deactivationKey = crypto.randomUUID();
    const result = await command.deactivateAssignment({
      actorId: admin.id,
      assignmentId: assignment.id,
      idempotencyKey: deactivationKey,
    });
    expect(result.replayed).toBe(false);
    await expect(
      command.deactivateAssignment({
        actorId: admin.id,
        assignmentId: assignment.id,
        idempotencyKey: deactivationKey,
      }),
    ).resolves.toMatchObject({ replayed: true });
    await request(app)
      .get(`/clients/${assigned.id}/support`)
      .set('x-test-principal', key)
      .expect(403);
    await expect(realtime.canSubscribeToClient(principals.get(key)!, assigned.id)).resolves.toBe(
      false,
    );
    expect(
      await prisma.securityEvent.count({
        where: { actorId: admin.id, eventType: 'AUTHZ_ASSIGNMENT_DEACTIVATED' },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { actorId: admin.id, action: 'STAFF_CLIENT_ASSIGNMENT_DEACTIVATED' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          eventKey: deactivationKey,
          eventType: 'authorization.staff-assignment-deactivated',
        },
      }),
    ).toBe(1);
  });

  test('honors only active compatible grants and observes revocation on the next request', async () => {
    const consultant = await staff('CONSULTANT', 'canonical-grantee');
    const target = await client('grant-target');
    const admin = await staff('ADMIN', 'grant-admin');
    const key = principal(consultant, 'granted-consultant');
    const app = appFor(createPrismaAuthorizationService(prisma));
    const commands = createAccessAdministration(prisma);

    await expect(
      commands.grantAccess({
        actorId: admin.id,
        granteeId: admin.id,
        clientId: target.id,
        scope: 'CONSULTANT_WORK',
        capabilities: ['review.publish'],
        reason: 'Compatibility boundary test',
        startsAt: new Date(Date.now() - 1_000),
        expiresAt: new Date(Date.now() + 60_000),
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toThrow('GRANT_CANNOT_CREATE_CAPABILITY');

    const granted = await commands.grantAccess({
      actorId: admin.id,
      granteeId: consultant.id,
      clientId: target.id,
      scope: 'SUPPORT_ONLY',
      capabilities: ['support.manage'],
      reason: 'Temporary support coverage',
      startsAt: new Date(Date.now() - 1_000),
      expiresAt: new Date(Date.now() + 60_000),
      idempotencyKey: crypto.randomUUID(),
    });
    await request(app)
      .get(`/clients/${target.id}/support`)
      .set('x-test-principal', key)
      .expect(200);
    await commands.revokeGrant({
      actorId: admin.id,
      grantId: granted.result.id,
      idempotencyKey: crypto.randomUUID(),
    });
    await request(app)
      .get(`/clients/${target.id}/support`)
      .set('x-test-principal', key)
      .expect(403);

    await prisma.clientAccessGrant.create({
      data: {
        granteeId: consultant.id,
        clientId: target.id,
        scope: 'SUPPORT_ONLY',
        allowedCapabilities: ['support.manage'],
        reason: 'Expired coverage',
        startsAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
        grantorId: admin.id,
      },
    });
    await request(app)
      .get(`/clients/${target.id}/support`)
      .set('x-test-principal', key)
      .expect(403);
  });

  test('fails closed and emits a safe category when policy storage fails', async () => {
    const consultant = await staff('CONSULTANT', 'lookup-failure');
    const target = await client('lookup-target');
    const key = principal(consultant, 'lookup-failure-principal');
    const failing: AuthorizationService = {
      authorize: async () => Promise.reject(new Error('db')),
    };
    await request(appFor(failing))
      .get(`/clients/${target.id}/support`)
      .set('x-test-principal', key)
      .expect(403);
    const event = await prisma.securityEvent.findFirstOrThrow({
      where: { actorId: consultant.id, clientId: target.id, eventType: 'AUTHZ_ACCESS_DENIED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(event.category).toBe('AUTHORIZATION_LOOKUP_FAILED');
    expect(event.metadata).toEqual({ capability: 'support.manage', role: 'CONSULTANT' });
  });
});
