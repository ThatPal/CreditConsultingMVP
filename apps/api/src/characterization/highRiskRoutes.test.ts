import { createServer, type Server } from 'node:http';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthService } from '../auth/authService.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import { publishLiveUpdate } from '../liveUpdates.js';
import { createOperationsRouter } from '../operations/routes.js';
import { createReviewRouter } from '../reviews/routes.js';
import type { DocumentStorage } from '../storage/documentStorage.js';

const principals = new Map<string, AuthPrincipal>();
const bytesByKey = new Map<string, Buffer>();
const storage: DocumentStorage = {
  async put(storageKey, content) {
    bytesByKey.set(storageKey, content);
    return {
      provider: 'LOCAL_DISK',
      storageKey,
      sizeBytes: content.length,
      sha256: 'test-sha',
    };
  },
  async read(storageKey) {
    return bytesByKey.get(storageKey) ?? null;
  },
  async delete(storageKey) {
    bytesByKey.delete(storageKey);
  },
};

let prisma: PrismaClient;
let auth: AuthService;
let sequence = 0;

function principalHeader(principal: AuthPrincipal) {
  const key = `principal-${++sequence}`;
  principals.set(key, principal);
  return key;
}

function buildApp(heartbeatIntervalMs = 60_000) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const principal = principals.get(req.get('x-test-principal') ?? '');
    if (principal) req.auth = principal;
    next();
  });
  app.use('/reviews', createReviewRouter(prisma, auth, storage));
  app.use('/api/v1', createOperationsRouter(prisma, auth, { heartbeatIntervalMs }));
  app.use(errorHandler(pino({ level: 'silent' })));
  return app;
}

async function createClient(label: string, assignedConsultantId?: string) {
  const user = await prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@example.com`,
      role: 'CLIENT',
      status: 'ACTIVE',
    },
  });
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      firstName: label,
      lastName: 'Client',
      termsAcceptedAt: new Date(),
      ...(assignedConsultantId ? { assignedConsultantId } : {}),
    },
  });
  if (assignedConsultantId)
    await prisma.staffClientAssignment.upsert({
      where: { staffUserId_clientId: { staffUserId: assignedConsultantId, clientId: client.id } },
      create: { staffUserId: assignedConsultantId, clientId: client.id },
      update: { deactivatedAt: null },
    });
  const principal: AuthPrincipal = {
    userId: user.id,
    email: user.email,
    role: 'CLIENT',
    status: 'ACTIVE',
    clientId: client.id,
  };
  return { user, client, principal, header: principalHeader(principal) };
}

async function createStaff(role: 'CONSULTANT' | 'ADMIN', label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${label}-${crypto.randomUUID()}@example.com`,
      role,
      status: 'ACTIVE',
    },
  });
  const principal: AuthPrincipal = {
    userId: user.id,
    email: user.email,
    role,
    status: 'ACTIVE',
    clientId: null,
    staffMfaEnabled: true,
    staffMfaVerified: true,
    stepUpVerified: true,
  };
  return { user, principal, header: principalHeader(principal) };
}

async function createPurchase(
  clientId: string,
  status: 'PENDING' | 'PAID' = 'PAID',
  serviceType:
    | 'CREDIT_PROFILE_REVIEW'
    | 'CREDIT_CARD_ROUND'
    | 'MAJOR_APPLICATION_READINESS' = 'CREDIT_PROFILE_REVIEW',
) {
  return prisma.servicePurchase.create({
    data: {
      clientId,
      serviceType,
      amount: 100,
      status,
      paymentProvider: 'MANUAL',
      ...(status === 'PAID' ? { purchasedAt: new Date() } : {}),
    },
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for characterization');
  prisma = createPrisma(process.env.DATABASE_URL);
  await prisma.$connect();
  auth = {
    canAccessClient: async (principal: AuthPrincipal, clientId: string) =>
      principal.role === 'ADMIN' ||
      (principal.role === 'CLIENT'
        ? principal.clientId === clientId
        : Boolean(
            await prisma.client.findFirst({
              where: { id: clientId, assignedConsultantId: principal.userId },
              select: { id: true },
            }),
          )),
  } as unknown as AuthService;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Review entitlement and report authorization characterization', () => {
  test('accepts paid purchase and live ReviewPlan fallback, while rejecting invalid purchases and a second active Review', async () => {
    const app = buildApp();

    const paidClient = await createClient('paid-review');
    const paid = await createPurchase(paidClient.client.id);
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', paidClient.header)
      .send({ purchaseId: paid.id })
      .expect(201);
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', paidClient.header)
      .send({ purchaseId: paid.id })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('REVIEW_ALREADY_ACTIVE'));

    const planClient = await createClient('plan-review');
    await prisma.reviewPlan.create({
      data: {
        clientId: planClient.client.id,
        frequency: 'QUARTERLY',
        price: 200,
        paymentProvider: 'MANUAL',
      },
    });
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', planClient.header)
      .send({})
      .expect(201);

    const pendingClient = await createClient('pending-review');
    const pending = await createPurchase(pendingClient.client.id, 'PENDING');
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', pendingClient.header)
      .send({ purchaseId: pending.id })
      .expect(409);

    const wrongOwner = await createClient('wrong-owner');
    const wrongCaller = await createClient('wrong-caller');
    const otherPurchase = await createPurchase(wrongOwner.client.id);
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', wrongCaller.header)
      .send({ purchaseId: otherPurchase.id })
      .expect(409);

    const wrongServiceClient = await createClient('wrong-service');
    const wrongService = await createPurchase(
      wrongServiceClient.client.id,
      'PAID',
      'CREDIT_CARD_ROUND',
    );
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', wrongServiceClient.header)
      .send({ purchaseId: wrongService.id })
      .expect(409);

    const usedClient = await createClient('used-purchase');
    const used = await createPurchase(usedClient.client.id);
    await prisma.creditReview.create({
      data: {
        clientId: usedClient.client.id,
        purchaseId: used.id,
        status: 'COMPLETE',
        completedAt: new Date(),
      },
    });
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', usedClient.header)
      .send({ purchaseId: used.id })
      .expect(409);
  });

  test('scopes report listing/content to owner and assigned consultant', async () => {
    const assigned = await createStaff('CONSULTANT', 'assigned-report');
    const unassigned = await createStaff('CONSULTANT', 'unassigned-report');
    const owner = await createClient('report-owner', assigned.user.id);
    const stranger = await createClient('report-stranger');
    const document = await prisma.creditReportDocument.create({
      data: {
        storageKey: `credit-reports/${owner.client.id}/${crypto.randomUUID()}.pdf`,
        originalFileName: 'report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 3,
        sha256: 'test-sha',
        uploadedByUserId: owner.user.id,
      },
    });
    bytesByKey.set(document.storageKey, Buffer.from('pdf'));
    const review = await prisma.creditReview.create({
      data: {
        clientId: owner.client.id,
        intake: {
          create: { reportDocumentId: document.id, reportDocumentKey: document.storageKey },
        },
      },
    });

    await request(buildApp())
      .get('/reviews/report-documents/client')
      .set('x-test-principal', owner.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.documents.map(({ id }: { id: string }) => id)).toContain(document.id),
      );
    await request(buildApp())
      .get('/reviews/report-documents/client')
      .set('x-test-principal', stranger.header)
      .expect(200)
      .expect(({ body }) => expect(body.documents).toEqual([]));
    await request(buildApp())
      .get(`/reviews/report-documents/${document.id}/content`)
      .set('x-test-principal', owner.header)
      .expect(200, Buffer.from('pdf'));
    await request(buildApp())
      .get(`/reviews/report-documents/${document.id}/content`)
      .set('x-test-principal', stranger.header)
      .expect(404);
    await request(buildApp())
      .get(`/reviews/report-documents/${document.id}/content`)
      .set('x-test-principal', assigned.header)
      .expect(200);
    await request(buildApp())
      .get(`/reviews/report-documents/${document.id}/content`)
      .set('x-test-principal', unassigned.header)
      .expect(404);
    await request(buildApp())
      .get(`/reviews/consultant/${owner.client.id}/${review.id}`)
      .set('x-test-principal', assigned.header)
      .expect(200);
    await request(buildApp())
      .get(`/reviews/consultant/${owner.client.id}/${review.id}`)
      .set('x-test-principal', unassigned.header)
      .expect(403);
  });
});

describe('Support, notification, and application-cycle characterization', () => {
  test('uses canonical temporary grants for consultant inbox discovery and detail access', async () => {
    const consultant = await createStaff('CONSULTANT', 'support-grantee');
    const expiredConsultant = await createStaff('CONSULTANT', 'expired-support-grantee');
    const admin = await createStaff('ADMIN', 'support-grantor');
    const owner = await createClient('support-grant-owner');
    const supportCase = await prisma.supportCase.create({
      data: {
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        category: 'ACCOUNT',
        subject: 'Grant-visible request',
      },
    });
    const grant = await prisma.clientAccessGrant.create({
      data: {
        granteeId: consultant.user.id,
        clientId: owner.client.id,
        scope: 'SUPPORT_ONLY',
        allowedCapabilities: ['support.manage'],
        reason: 'Temporary support coverage',
        startsAt: new Date(Date.now() - 1_000),
        expiresAt: new Date(Date.now() + 60_000),
        grantorId: admin.user.id,
      },
    });
    await prisma.clientAccessGrant.create({
      data: {
        granteeId: expiredConsultant.user.id,
        clientId: owner.client.id,
        scope: 'SUPPORT_ONLY',
        allowedCapabilities: ['support.manage'],
        reason: 'Expired temporary support coverage',
        startsAt: new Date(Date.now() - 120_000),
        expiresAt: new Date(Date.now() - 60_000),
        grantorId: admin.user.id,
      },
    });
    const app = buildApp();
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', consultant.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).toContain(supportCase.id),
      );
    await request(app)
      .get(`/api/v1/consultant/support-cases/${supportCase.id}`)
      .set('x-test-principal', consultant.header)
      .expect(200);
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', expiredConsultant.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).not.toContain(supportCase.id),
      );
    await request(app)
      .get(`/api/v1/consultant/support-cases/${supportCase.id}`)
      .set('x-test-principal', expiredConsultant.header)
      .expect(403);

    await prisma.clientAccessGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date(), revokerId: admin.user.id },
    });
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', consultant.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).not.toContain(supportCase.id),
      );
    await request(app)
      .get(`/api/v1/consultant/support-cases/${supportCase.id}`)
      .set('x-test-principal', consultant.header)
      .expect(403);
  });

  test('governs visible reply lifecycle centrally and keeps retries duplicate-safe', async () => {
    const consultant = await createStaff('CONSULTANT', 'support-lifecycle');
    const owner = await createClient('support-lifecycle-owner', consultant.user.id);
    const supportCase = await prisma.supportCase.create({
      data: {
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        assignedToUserId: consultant.user.id,
        category: 'ACCOUNT',
        subject: 'Lifecycle request',
      },
    });
    const app = buildApp();
    const clientKey = `client-reply-${crypto.randomUUID()}`;
    await request(app)
      .post(`/api/v1/client/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', clientKey)
      .send({ message: 'Client follow-up' })
      .expect(201);
    await request(app)
      .post(`/api/v1/client/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', clientKey)
      .send({ message: 'Client follow-up' })
      .expect(200);
    expect(
      (await prisma.supportCase.findUniqueOrThrow({ where: { id: supportCase.id } })).status,
    ).toBe('WAITING_ON_SUPPORT');
    expect(
      await prisma.supportMessage.count({
        where: { supportCaseId: supportCase.id, idempotencyKey: clientKey },
      }),
    ).toBe(1);
    expect(
      await Promise.all([
        prisma.outboxEvent.count({
          where: { eventKey: `support.message.created:${supportCase.id}:${clientKey}` },
        }),
        prisma.notification.count({
          where: {
            userId: consultant.user.id,
            clientId: owner.client.id,
            type: 'SUPPORT_MESSAGE',
            title: 'New client message',
            link: `/consultant/support?case=${supportCase.id}`,
          },
        }),
        prisma.auditEvent.count({
          where: {
            clientId: owner.client.id,
            actorId: owner.user.id,
            action: 'SUPPORT_MESSAGE_SENT',
            entityType: 'SupportCase',
            entityId: supportCase.id,
          },
        }),
      ]),
    ).toEqual([1, 1, 1]);

    const staffKey = `staff-reply-${crypto.randomUUID()}`;
    await request(app)
      .post(`/api/v1/consultant/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', consultant.header)
      .set('Idempotency-Key', staffKey)
      .send({ message: 'Consultant response', internal: false })
      .expect(201);
    await request(app)
      .post(`/api/v1/consultant/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', consultant.header)
      .set('Idempotency-Key', staffKey)
      .send({ message: 'Consultant response', internal: false })
      .expect(200);
    expect(
      (await prisma.supportCase.findUniqueOrThrow({ where: { id: supportCase.id } })).status,
    ).toBe('WAITING_ON_CLIENT');
    expect(
      await prisma.supportMessage.count({
        where: { supportCaseId: supportCase.id, idempotencyKey: staffKey },
      }),
    ).toBe(1);
    expect(
      await Promise.all([
        prisma.outboxEvent.count({
          where: { eventKey: `support.message.created:${supportCase.id}:${staffKey}` },
        }),
        prisma.notification.count({
          where: {
            userId: owner.user.id,
            clientId: owner.client.id,
            type: 'SUPPORT_MESSAGE',
            title: 'New support reply',
            link: `/app/support?case=${supportCase.id}`,
          },
        }),
        prisma.auditEvent.count({
          where: {
            clientId: owner.client.id,
            actorId: consultant.user.id,
            action: 'SUPPORT_REPLY_SENT',
            entityType: 'SupportCase',
            entityId: supportCase.id,
          },
        }),
      ]),
    ).toEqual([1, 1, 1]);

    const beforeInternal = await prisma.supportCase.findUniqueOrThrow({
      where: { id: supportCase.id },
    });
    const clientNotifications = await prisma.notification.count({
      where: { userId: owner.user.id, clientId: owner.client.id },
    });
    await request(app)
      .post(`/api/v1/consultant/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', consultant.header)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ message: 'Internal-only note', internal: true })
      .expect(201);
    const afterInternal = await prisma.supportCase.findUniqueOrThrow({
      where: { id: supportCase.id },
    });
    expect(afterInternal.status).toBe(beforeInternal.status);
    expect(afterInternal.lastMessageAt).toEqual(beforeInternal.lastMessageAt);
    expect(
      await prisma.notification.count({
        where: { userId: owner.user.id, clientId: owner.client.id },
      }),
    ).toBe(clientNotifications);

    await prisma.supportCase.update({
      where: { id: supportCase.id },
      data: { status: 'RESOLVED' },
    });
    await request(app)
      .post(`/api/v1/client/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', owner.header)
      .send({ message: 'Reply after resolution' })
      .expect(409);
    await prisma.supportCase.update({ where: { id: supportCase.id }, data: { status: 'CLOSED' } });
    await request(app)
      .post(`/api/v1/consultant/support-cases/${supportCase.id}/messages`)
      .set('x-test-principal', consultant.header)
      .send({ message: 'Reply after close', internal: false })
      .expect(409);
  });

  test('creates an auditable support request exactly once and preserves client isolation', async () => {
    const consultant = await createStaff('CONSULTANT', 'support-command');
    const owner = await createClient('support-command-owner', consultant.user.id);
    const stranger = await createClient('support-command-stranger');
    const app = buildApp();
    const idempotencyKey = `support-${crypto.randomUUID()}`;
    const payload = {
      category: 'ACCOUNT',
      priority: 'NORMAL',
      subject: 'Cannot update my profile',
      message: 'Please help me update my profile.',
      contextType: 'GENERAL',
      attachmentDocumentIds: [],
    };

    const first = await request(app)
      .post('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);
    const replay = await request(app)
      .post('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(200);

    expect(replay.body.replayed).toBe(true);
    expect(replay.body.case.id).toBe(first.body.case.id);
    expect(await prisma.supportCase.count({ where: { id: first.body.case.id } })).toBe(1);
    expect(
      await prisma.supportMessage.count({ where: { supportCaseId: first.body.case.id } }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'SUPPORT_CASE_CREATED', entityId: first.body.case.id },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: 'support.ticket.created', aggregateId: first.body.case.id },
      }),
    ).toBe(1);

    await request(app)
      .get(`/api/v1/client/support-cases/${first.body.case.id}`)
      .set('x-test-principal', stranger.header)
      .expect(404);
    await request(app)
      .get(`/api/v1/consultant/support-cases/${first.body.case.id}`)
      .set('x-test-principal', consultant.header)
      .expect(200);
  });

  test('enforces typed-context and attachment ownership without leaking storage metadata', async () => {
    const consultant = await createStaff('CONSULTANT', 'support-document');
    const owner = await createClient('support-document-owner', consultant.user.id);
    const stranger = await createClient('support-document-stranger');
    const documentType = await prisma.documentType.findUniqueOrThrow({
      where: { key: 'SUPPORT_ATTACHMENT' },
    });
    const ownDocument = await prisma.document.create({
      data: {
        clientId: owner.client.id,
        documentTypeId: documentType.id,
        originalFileName: 'owner.pdf',
        displayFileName: 'Owner report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        storageProvider: 'LOCAL_DISK',
        storageKey: `private/${crypto.randomUUID()}`,
        clientVisible: true,
        uploadedByUserId: owner.user.id,
        retentionCategory: 'SUPPORT_RECORD',
      },
    });
    const otherDocument = await prisma.document.create({
      data: {
        clientId: stranger.client.id,
        documentTypeId: documentType.id,
        originalFileName: 'other.pdf',
        displayFileName: 'Other report.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        sha256: 'b'.repeat(64),
        storageProvider: 'LOCAL_DISK',
        storageKey: `private/${crypto.randomUUID()}`,
        clientVisible: true,
        uploadedByUserId: stranger.user.id,
        retentionCategory: 'SUPPORT_RECORD',
      },
    });
    const app = buildApp();
    const payload = {
      category: 'DOCUMENTS',
      subject: 'Question about my report',
      message: 'Please review this report with me.',
      contextType: 'DOCUMENT',
      contextResourceId: ownDocument.id,
      attachmentDocumentIds: [ownDocument.id],
    };
    const created = await request(app)
      .post('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(payload)
      .expect(201);
    const serialized = JSON.stringify(created.body);
    expect(serialized).toContain('Owner report.pdf');
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('storageProvider');
    expect(serialized).not.toContain('private/');

    await request(app)
      .post('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ ...payload, contextResourceId: otherDocument.id, attachmentDocumentIds: [] })
      .expect(404);
    await request(app)
      .post('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        ...payload,
        contextType: 'GENERAL',
        contextResourceId: null,
        attachmentDocumentIds: [otherDocument.id],
      })
      .expect(404);
  });

  test('keeps support cases client-scoped, hides internal messages, and enforces staff assignment', async () => {
    const assigned = await createStaff('CONSULTANT', 'assigned-support');
    const unassigned = await createStaff('CONSULTANT', 'unassigned-support');
    const admin = await createStaff('ADMIN', 'admin-support');
    const owner = await createClient('support-owner', assigned.user.id);
    const stranger = await createClient('support-stranger', unassigned.user.id);
    const ownerCase = await prisma.supportCase.create({
      data: {
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        assignedToUserId: assigned.user.id,
        category: 'ACCOUNT',
        subject: 'Owner case',
        messages: {
          create: [
            { authorUserId: owner.user.id, body: 'Visible client message' },
            { authorUserId: assigned.user.id, body: 'Hidden internal note', internal: true },
          ],
        },
      },
    });
    await prisma.supportCase.create({
      data: {
        clientId: stranger.client.id,
        createdByUserId: stranger.user.id,
        assignedToUserId: unassigned.user.id,
        category: 'ACCOUNT',
        subject: 'Stranger case',
      },
    });
    const app = buildApp();
    await request(app)
      .get('/api/v1/client/support-cases')
      .set('x-test-principal', owner.header)
      .expect(200)
      .expect(({ body }) => {
        expect(body.cases).toHaveLength(1);
        expect(body.cases[0].id).toBe(ownerCase.id);
        expect(body.cases[0].messages.map(({ body: text }: { body: string }) => text)).toEqual([
          'Visible client message',
        ]);
      });
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', assigned.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).toEqual([ownerCase.id]),
      );
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', unassigned.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).not.toContain(ownerCase.id),
      );
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', admin.header)
      .expect(403);
  });

  test('scopes notification reads and updates to the authenticated user', async () => {
    const owner = await createClient('notification-owner');
    const stranger = await createClient('notification-stranger');
    const own = await prisma.notification.create({
      data: {
        userId: owner.user.id,
        clientId: owner.client.id,
        semanticKey: `test-own-${owner.user.id}`,
        type: 'TEST',
        title: 'Own',
        body: 'Own',
      },
    });
    const other = await prisma.notification.create({
      data: {
        userId: stranger.user.id,
        clientId: stranger.client.id,
        semanticKey: `test-other-${stranger.user.id}`,
        type: 'TEST',
        title: 'Other',
        body: 'Other',
      },
    });
    const app = buildApp();
    await request(app)
      .get('/api/v1/notifications')
      .set('x-test-principal', owner.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.notifications.map(({ id }: { id: string }) => id)).toEqual([own.id]),
      );
    await request(app)
      .patch(`/api/v1/notifications/${other.id}/read`)
      .set('x-test-principal', owner.header)
      .expect(404);
    await request(app)
      .patch(`/api/v1/notifications/${own.id}/read`)
      .set('x-test-principal', owner.header)
      .expect(200);
    await expect(
      prisma.notification.findUniqueOrThrow({ where: { id: other.id } }),
    ).resolves.toMatchObject({ readAt: null });
  });

  test('creates one active cycle and advances only the owning client goal step', async () => {
    const owner = await createClient('cycle-owner');
    const stranger = await createClient('cycle-stranger');
    await prisma.clientGoal.create({
      data: {
        clientId: owner.client.id,
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: 25_000,
        priority: 'PRIMARY',
      },
    });
    const app = buildApp();
    const created = await request(app)
      .post('/api/v1/client/application-cycles')
      .set('x-test-principal', owner.header)
      .expect(201);
    const cycleId = created.body.cycle.id as string;
    await request(app)
      .post('/api/v1/client/application-cycles')
      .set('x-test-principal', owner.header)
      .expect(409);
    await request(app)
      .post(`/api/v1/client/application-cycles/${cycleId}/confirm-goal`)
      .set('x-test-principal', stranger.header)
      .expect(404);
    await request(app)
      .post(`/api/v1/client/application-cycles/${cycleId}/confirm-goal`)
      .set('x-test-principal', owner.header)
      .expect(200);
    const cycle = await prisma.applicationCycle.findUniqueOrThrow({
      where: { id: cycleId },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
    expect(cycle.currentStage).toBe('REVIEW_PURCHASE');
    expect(cycle.steps[0]?.status).toBe('COMPLETE');
    expect(cycle.steps[1]?.status).toBe('AVAILABLE');
    expect(cycle.steps.slice(2).every((step) => step.status === 'NOT_STARTED')).toBe(true);
  });
});

async function startStreamingApp(heartbeatIntervalMs: number) {
  const server = createServer(buildApp(heartbeatIntervalMs));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  return { server, url: `http://127.0.0.1:${address.port}/api/v1/live-updates` };
}

async function openSse(url: string, header: string) {
  const controller = new AbortController();
  const response = await fetch(url, {
    headers: { 'x-test-principal': header },
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const first = await reader.read();
  expect(decoder.decode(first.value)).toContain('event: ready');
  return { controller, reader, decoder };
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe('authenticated SSE characterization', () => {
  test('delivers only client-owned and assigned-consultant domain events', async () => {
    const assigned = await createStaff('CONSULTANT', 'assigned-sse');
    const unassigned = await createStaff('CONSULTANT', 'unassigned-sse');
    const owner = await createClient('sse-owner', assigned.user.id);
    const stranger = await createClient('sse-stranger');
    const { server, url } = await startStreamingApp(60_000);
    try {
      for (const [header, allowedClientId, expected] of [
        [owner.header, owner.client.id, true],
        [owner.header, stranger.client.id, false],
        [assigned.header, owner.client.id, true],
        [unassigned.header, owner.client.id, false],
      ] as const) {
        const stream = await openSse(url, header);
        const pending = stream.reader.read();
        publishLiveUpdate(allowedClientId, 'review');
        if (expected) {
          const next = await pending;
          const text = stream.decoder.decode(next.value);
          expect(text).toContain('event: refresh');
          expect(text).toContain(allowedClientId);
        } else {
          const result = await Promise.race([
            pending.then(() => 'event'),
            new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 100)),
          ]);
          expect(result).toBe('timeout');
        }
        stream.controller.abort();
        await stream.reader.cancel().catch(() => undefined);
      }
    } finally {
      await closeServer(server);
    }
  });

  test('emits heartbeat as an SSE comment rather than a domain refresh', async () => {
    const owner = await createClient('sse-heartbeat');
    const { server, url } = await startStreamingApp(15);
    try {
      const stream = await openSse(url, owner.header);
      const next = await stream.reader.read();
      const text = stream.decoder.decode(next.value);
      expect(text).toContain(': heartbeat');
      expect(text).not.toContain('event: refresh');
      stream.controller.abort();
      await stream.reader.cancel().catch(() => undefined);
    } finally {
      await closeServer(server);
    }
  });
});
