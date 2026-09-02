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
import { reconcileSupportAttention } from '../attention/attentionService.js';

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
  test('reserves purchased credit and live ReviewPlan fallback, while rejecting no-credit and second-active starts', async () => {
    const app = buildApp();

    const paidClient = await createClient('paid-review');
    const paid = await createPurchase(paidClient.client.id);
    await prisma.reviewCreditTransaction.create({
      data: {
        clientId: paidClient.client.id,
        purchaseId: paid.id,
        sourceKey: `characterization:${paid.id}`,
        transactionType: 'PURCHASE',
        availableDelta: 1,
        reason: 'Characterization purchased credit',
      },
    });
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', paidClient.header)
      .set('idempotency-key', `start-${paid.id}`)
      .send({ intendedReportDate: '2026-08-01' })
      .expect(201);
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', paidClient.header)
      .set('idempotency-key', `start-again-${paid.id}`)
      .send({ intendedReportDate: '2026-08-01' })
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
      .set('idempotency-key', `start-plan-${planClient.client.id}`)
      .send({ intendedReportDate: '2026-08-02' })
      .expect(201);

    const noCreditClient = await createClient('no-credit-review');
    await request(app)
      .post('/reviews/client')
      .set('x-test-principal', noCreditClient.header)
      .set('idempotency-key', `start-none-${noCreditClient.client.id}`)
      .send({ intendedReportDate: '2026-08-03' })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe('REVIEW_CREDIT_REQUIRED'));
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

  test('keeps rejected and date-discrepant replacements non-authoritative and owner scoped', async () => {
    const owner = await createClient('report-validation-owner');
    const stranger = await createClient('report-validation-stranger');
    const review = await prisma.creditReview.create({
      data: {
        clientId: owner.client.id,
        intendedReportDate: new Date('2026-08-15T00:00:00Z'),
        status: 'INTAKE_REQUIRED',
        intake: { create: {} },
      },
    });
    const validPdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
    const valid = await request(buildApp())
      .post(`/reviews/client/${review.id}/report-document`)
      .set('x-test-principal', owner.header)
      .set('content-type', 'application/pdf')
      .set('x-file-name', encodeURIComponent('report.pdf'))
      .set('x-report-source', encodeURIComponent('Experian 3-Bureau Credit Report'))
      .set('x-report-date', '2026-08-15')
      .send(validPdf)
      .expect(201);
    expect(valid.body.document.validationStatus).toBe('VALIDATED');
    const authoritative = await prisma.reviewIntake.findUnique({ where: { reviewId: review.id } });
    expect(authoritative?.reportDocumentId).toBe(valid.body.document.id);

    const invalid = await request(buildApp())
      .post(`/reviews/client/${review.id}/report-document`)
      .set('x-test-principal', owner.header)
      .set('content-type', 'application/pdf')
      .set('x-file-name', encodeURIComponent('bad.pdf'))
      .set('x-report-source', encodeURIComponent('Experian 3-Bureau Credit Report'))
      .set('x-report-date', '2026-08-15')
      .send(Buffer.from('not a pdf'))
      .expect(201);
    expect(invalid.body.document).toMatchObject({
      validationStatus: 'REJECTED',
      rejectionCode: 'INVALID_PDF_SIGNATURE',
    });

    const discrepancy = await request(buildApp())
      .post(`/reviews/client/${review.id}/report-document`)
      .set('x-test-principal', owner.header)
      .set('content-type', 'application/pdf')
      .set('x-file-name', encodeURIComponent('different-date.pdf'))
      .set('x-report-source', encodeURIComponent('Experian 3-Bureau Credit Report'))
      .set('x-report-date', '2026-08-16')
      .send(validPdf)
      .expect(201);
    expect(discrepancy.body.document.validationStatus).toBe('NEEDS_STAFF_REVIEW');
    await expect(
      prisma.reviewIntake.findUnique({ where: { reviewId: review.id } }),
    ).resolves.toMatchObject({ reportDocumentId: valid.body.document.id });
    await expect(
      prisma.creditReportDocument.findUnique({ where: { id: valid.body.document.id } }),
    ).resolves.toMatchObject({ supersededAt: null, supersededById: null });

    await request(buildApp())
      .post(`/reviews/client/${review.id}/report-document`)
      .set('x-test-principal', stranger.header)
      .set('content-type', 'application/pdf')
      .set('x-file-name', encodeURIComponent('report.pdf'))
      .set('x-report-source', encodeURIComponent('Experian 3-Bureau Credit Report'))
      .set('x-report-date', '2026-08-15')
      .send(validPdf)
      .expect(404);
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
      .get('/api/v1/client/support-cases?search=Stranger&pageSize=1')
      .set('x-test-principal', owner.header)
      .expect(200)
      .expect(({ body }) => {
        expect(body.cases).toEqual([]);
        expect(body).toMatchObject({ page: 1, pageSize: 1, total: 0, hasMore: false });
      });
    await request(app)
      .get('/api/v1/consultant/support-cases')
      .set('x-test-principal', assigned.header)
      .expect(200)
      .expect(({ body }) =>
        expect(body.cases.map(({ id }: { id: string }) => id)).toEqual([ownerCase.id]),
      );
    await request(app)
      .get('/api/v1/consultant/support-cases?search=Stranger&pageSize=1')
      .set('x-test-principal', assigned.header)
      .expect(200)
      .expect(({ body }) => expect(body.cases).toEqual([]));
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

  test('orders active client tickets first and keeps tied support pagination stable without gaps', async () => {
    const assigned = await createStaff('CONSULTANT', 'pagination-support');
    const owner = await createClient('pagination-owner', assigned.user.id);
    const timestamp = new Date('2026-08-31T20:00:00.000Z');
    const idPrefix = crypto.randomUUID().slice(0, -1);
    const records = [
      { id: `${idPrefix}1`, status: 'OPEN' as const },
      { id: `${idPrefix}2`, status: 'WAITING_ON_CLIENT' as const },
      { id: `${idPrefix}3`, status: 'RESOLVED' as const },
      { id: `${idPrefix}4`, status: 'CLOSED' as const },
    ];
    await prisma.supportCase.createMany({
      data: records.map((record) => ({
        ...record,
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        assignedToUserId: assigned.user.id,
        category: 'ACCOUNT',
        priority: 'NORMAL',
        subject: `Pagination proof ${record.id.at(-1)}`,
        lastMessageAt: timestamp,
        ...(record.status === 'RESOLVED' || record.status === 'CLOSED'
          ? { resolvedAt: timestamp }
          : {}),
      })),
    });
    const app = buildApp();
    const clientPages = await Promise.all(
      [1, 2].map((page) =>
        request(app)
          .get(`/api/v1/client/support-cases?search=Pagination%20proof&page=${page}&pageSize=2`)
          .set('x-test-principal', owner.header)
          .expect(200),
      ),
    );
    const clientIds = clientPages.flatMap(({ body }) =>
      body.cases.map(({ id }: { id: string }) => id),
    );
    expect(clientIds).toEqual([records[1]!.id, records[0]!.id, records[3]!.id, records[2]!.id]);
    expect(new Set(clientIds).size).toBe(4);

    const consultantPages = await Promise.all(
      [1, 2].map((page) =>
        request(app)
          .get(`/api/v1/consultant/support-cases?search=Pagination%20proof&page=${page}&pageSize=2`)
          .set('x-test-principal', assigned.header)
          .expect(200),
      ),
    );
    const consultantIds = consultantPages.flatMap(({ body }) =>
      body.cases.map(({ id }: { id: string }) => id),
    );
    expect(consultantIds).toEqual(records.map(({ id }) => id).reverse());
    expect(new Set(consultantIds).size).toBe(4);
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

describe('Attention Work Queue characterization', () => {
  test('deduplicates domain attention, enforces authorization, and permits only one competing claim', async () => {
    const assigned = await createStaff('CONSULTANT', 'queue-assigned');
    const temporary = await createStaff('CONSULTANT', 'queue-temporary');
    const admin = await createStaff('ADMIN', 'queue-admin');
    const owner = await createClient('queue-owner', assigned.user.id);
    const temporaryGrant = await prisma.clientAccessGrant.create({
      data: {
        granteeId: temporary.user.id,
        clientId: owner.client.id,
        scope: 'SUPPORT_ONLY',
        allowedCapabilities: ['support.manage'],
        reason: 'Queue coverage',
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 3_600_000),
        grantorId: admin.user.id,
      },
    });
    const ticket = await prisma.supportCase.create({
      data: {
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        category: 'OTHER',
        priority: 'URGENT',
        status: 'WAITING_ON_SUPPORT',
        subject: 'Queue concurrency proof',
        lastMessageAt: new Date(),
      },
    });
    await reconcileSupportAttention(prisma, ticket);
    await reconcileSupportAttention(prisma, ticket);
    expect(
      await prisma.workItem.count({
        where: {
          dedupeKey: `SUPPORT_CASE:${ticket.id}:REPLY_NEEDED`,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
        },
      }),
    ).toBe(1);

    const app = buildApp();
    expect(
      (
        await request(app)
          .get('/api/v1/consultant/work-queue')
          .set('x-test-principal', admin.header)
      ).status,
    ).toBe(403);
    const listed = await request(app)
      .get('/api/v1/consultant/work-queue?pageSize=10')
      .set('x-test-principal', assigned.header);
    expect(listed.status).toBe(200);
    const item = listed.body.items.find(
      (candidate: { sourceId: string }) => candidate.sourceId === ticket.id,
    );
    expect(item.authority).toBe('ATTENTION_PROJECTION');
    expect(item.deepLink).toEqual({
      type: 'SUPPORT_CASE',
      route: '/crm/support',
      params: { caseId: ticket.id },
    });
    const results = await Promise.all([
      request(app)
        .post(`/api/v1/consultant/work-queue/${item.id}/claim`)
        .set('x-test-principal', assigned.header)
        .send({ expectedVersion: item.version }),
      request(app)
        .post(`/api/v1/consultant/work-queue/${item.id}/claim`)
        .set('x-test-principal', temporary.header)
        .send({ expectedVersion: item.version }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const winnerIndex = results.findIndex((result) => result.status === 200);
    const winner = results[winnerIndex]!;
    const winnerPrincipal = winnerIndex === 0 ? assigned : temporary;
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ATTENTION_ITEM_CLAIMED', entityId: item.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ATTENTION_ITEM_CLAIM_CONFLICT', entityId: item.id },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: 'attention.item.claimed', aggregateId: item.id },
      }),
    ).toBe(1);

    const replay = await request(app)
      .post(`/api/v1/consultant/work-queue/${item.id}/claim`)
      .set('x-test-principal', winnerPrincipal.header)
      .send({ expectedVersion: winner.body.item.version });
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ATTENTION_ITEM_CLAIMED', entityId: item.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ATTENTION_ITEM_CLAIM_CONFLICT', entityId: item.id },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: 'attention.item.claimed', aggregateId: item.id },
      }),
    ).toBe(1);

    await reconcileSupportAttention(prisma, { ...ticket, subject: 'Materially updated request' });
    const stale = await request(app)
      .post(`/api/v1/consultant/work-queue/${item.id}/claim`)
      .set('x-test-principal', winnerPrincipal.header)
      .send({ expectedVersion: winner.body.item.version });
    expect(stale.status).toBe(409);
    expect(
      await prisma.auditEvent.count({
        where: {
          action: 'ATTENTION_ITEM_CLAIM_CONFLICT',
          entityId: item.id,
          metadata: { path: ['category'], equals: 'STALE_VERSION' },
        },
      }),
    ).toBe(1);

    const resolvedTicket = await prisma.supportCase.update({
      where: { id: ticket.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
    const completedItem = await reconcileSupportAttention(prisma, resolvedTicket);
    expect(completedItem?.status).toBe('COMPLETED');
    const resolvedReplay = await request(app)
      .post(`/api/v1/consultant/work-queue/${item.id}/claim`)
      .set('x-test-principal', winnerPrincipal.header)
      .send({ expectedVersion: completedItem!.version });
    expect(resolvedReplay.status).toBe(409);
    expect(resolvedReplay.body.error.code).toBe('ATTENTION_ITEM_NOT_ACTIONABLE');
    expect((await prisma.supportCase.findUniqueOrThrow({ where: { id: ticket.id } })).status).toBe(
      'RESOLVED',
    );
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(
      'COMPLETED',
    );

    const legacy = await prisma.workItem.create({
      data: {
        clientId: owner.client.id,
        title: 'Independent legacy task',
        domain: 'LEGACY',
      },
    });
    await reconcileSupportAttention(prisma, resolvedTicket);
    expect((await prisma.workItem.findUniqueOrThrow({ where: { id: legacy.id } })).authority).toBe(
      'LEGACY_INDEPENDENT',
    );

    const projectedCompletion = await request(app)
      .patch(`/api/v1/consultant/work-items/${item.id}`)
      .set('x-test-principal', winnerPrincipal.header)
      .send({ status: 'COMPLETED' });
    expect(projectedCompletion.status).toBe(409);
    expect(projectedCompletion.body.error.code).toBe('DOMAIN_STATE_REQUIRED');

    const authorizationTicket = await prisma.supportCase.create({
      data: {
        clientId: owner.client.id,
        createdByUserId: owner.user.id,
        category: 'OTHER',
        priority: 'NORMAL',
        status: 'WAITING_ON_SUPPORT',
        subject: 'Authorization recheck proof',
        lastMessageAt: new Date(),
      },
    });
    const authorizationItem = await reconcileSupportAttention(prisma, authorizationTicket);
    await prisma.clientAccessGrant.update({
      where: { id: temporaryGrant.id },
      data: { revokedAt: new Date(), revokerId: admin.user.id },
    });
    const revokedClaim = await request(app)
      .post(`/api/v1/consultant/work-queue/${authorizationItem!.id}/claim`)
      .set('x-test-principal', temporary.header)
      .send({ expectedVersion: authorizationItem!.version });
    expect(revokedClaim.status).toBe(403);
    expect(
      await prisma.auditEvent.count({
        where: {
          action: 'ATTENTION_ITEM_CLAIM_CONFLICT',
          entityId: authorizationItem!.id,
        },
      }),
    ).toBe(0);
  });
});

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
