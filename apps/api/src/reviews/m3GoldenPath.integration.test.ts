import express from 'express';
import { createHash } from 'node:crypto';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthService } from '../auth/authService.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import type { DocumentStorage } from '../storage/documentStorage.js';
import { DocumentStorageRegistry } from '../storage/documentStorage.js';
import { DurableAIRuntime } from '../ai/durableRuntime.js';
import {
  Phase7DeterministicProvider,
  RecordingAIQueue,
  advanceDurablePhase7Pipeline,
  phase7Validators,
} from '../ai/durableCreditReportPipeline.js';
import { supportedThreeBureauReport } from '../ai/fixtures/syntheticReports.js';
import { enqueueSubmittedReviewPipeline } from '../ai/submittedReviewPipeline.js';
import { createCreditProfileRouter, createReviewRouter } from './routes.js';

describe('M3 real application golden path', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `m3-${crypto.randomUUID()}`;
  const principals = new Map<string, AuthPrincipal>();
  const objects = new Map<string, Buffer>();
  const storage: DocumentStorage = {
    provider: 'LOCAL_DISK',
    async put(key, content) {
      objects.set(key, content);
      return {
        provider: 'LOCAL_DISK',
        storageKey: key,
        sizeBytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
      };
    },
    async read(key) {
      return objects.get(key) ?? null;
    },
    async openRead(key) {
      const value = objects.get(key);
      return value ? (await import('node:stream')).Readable.from(value) : null;
    },
    async exists(key) {
      return objects.has(key);
    },
    async delete(key) {
      objects.delete(key);
    },
  };
  const registry = new DocumentStorageRegistry('LOCAL_DISK', [storage]);
  let prisma: PrismaClient;
  let client: { id: string; userId: string };
  let consultantId: string;

  const header = (name: string, principal: AuthPrincipal) => {
    principals.set(name, principal);
    return name;
  };

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const consultant = await prisma.user.create({
      data: { email: `${marker}-consultant@example.test`, role: 'CONSULTANT', status: 'ACTIVE' },
    });
    consultantId = consultant.id;
    const user = await prisma.user.create({
      data: {
        email: `${marker}-client@example.test`,
        role: 'CLIENT',
        status: 'ACTIVE',
        client: {
          create: {
            firstName: 'Golden',
            lastName: 'Path',
            termsAcceptedAt: new Date(),
            assignedConsultantId: consultant.id,
          },
        },
      },
      include: { client: true },
    });
    client = { id: user.client!.id, userId: user.id };
    await prisma.staffClientAssignment.create({
      data: { staffUserId: consultant.id, clientId: client.id },
    });
    const purchase = await prisma.servicePurchase.create({
      data: {
        clientId: client.id,
        serviceType: 'CREDIT_PROFILE_REVIEW',
        amount: 100,
        status: 'PAID',
        paymentProvider: 'MANUAL',
        purchasedAt: new Date(),
      },
    });
    await prisma.reviewCreditTransaction.create({
      data: {
        clientId: client.id,
        purchaseId: purchase.id,
        sourceKey: `${marker}:credit`,
        transactionType: 'PURCHASE',
        availableDelta: 1,
        reason: 'M3 acceptance credit',
        authorizedByUserId: consultant.id,
      },
    });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('purchase credit through publish and client-safe Credit Center crosses protected HTTP boundaries', async () => {
    const clientPrincipal: AuthPrincipal = {
      userId: client.userId,
      email: `${marker}-client@example.test`,
      role: 'CLIENT',
      status: 'ACTIVE',
      clientId: client.id,
    };
    const consultantPrincipal: AuthPrincipal = {
      userId: consultantId,
      email: `${marker}-consultant@example.test`,
      role: 'CONSULTANT',
      status: 'ACTIVE',
      clientId: null,
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    };
    const clientHeader = header('client', clientPrincipal);
    const consultantHeader = header('consultant', consultantPrincipal);
    const queue = new RecordingAIQueue();
    const runtime = new DurableAIRuntime(
      prisma,
      queue,
      new Phase7DeterministicProvider(),
      phase7Validators,
    );
    const auth = { canAccessClient: async () => true } as unknown as AuthService;
    const authorization = {
      authorize: async () => true,
      authorizeCapability: async () => true,
    } as unknown as AuthorizationService;
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const principal = principals.get(req.get('x-test-principal') ?? '');
      if (principal) req.auth = principal;
      next();
    });
    app.use(
      '/reviews',
      createReviewRouter(
        prisma,
        auth,
        storage,
        authorization,
        async () => undefined,
        (reviewId) => enqueueSubmittedReviewPipeline(prisma, registry, runtime, reviewId),
      ),
    );
    app.use('/credit-profile', createCreditProfileRouter(prisma));
    app.use(errorHandler(pino({ level: 'silent' })));

    const reportDate = '2026-09-01';
    const eligibility = await request(app)
      .get(`/reviews/client/eligibility?intendedReportDate=${reportDate}`)
      .set('x-test-principal', clientHeader)
      .expect(200);
    expect(eligibility.body.eligibility.eligible).toBe(true);
    const started = await request(app)
      .post('/reviews/client')
      .set('x-test-principal', clientHeader)
      .set('Idempotency-Key', `${marker}:start`)
      .send({ intendedReportDate: reportDate })
      .expect(201);
    const reviewId = started.body.review.id as string;
    const bytes = Buffer.from(
      `%PDF-1.7\nCREDIT_SYNTHETIC_3_BUREAU_V1\n${JSON.stringify({ ...supportedThreeBureauReport, reportDateCandidates: [reportDate] })}\n%%EOF`,
    );
    await request(app)
      .post(`/reviews/client/${reviewId}/report-document`)
      .set('x-test-principal', clientHeader)
      .set('content-type', 'application/pdf')
      .set('x-file-name', 'experian-3-bureau.pdf')
      .set('x-report-source', 'Supported synthetic Experian 3-Bureau')
      .set('x-report-date', reportDate)
      .send(bytes)
      .expect(201);
    await request(app)
      .post(`/reviews/client/${reviewId}/card-review`)
      .set('x-test-principal', clientHeader)
      .send({
        status: 'NEW',
        cardName: 'Everyday',
        issuer: 'Example Bank',
        scope: 'PERSONAL',
        portfolioType: 'PERSONAL_CREDIT',
        maskedIdentifier: '4242',
        reportsToBureaus: true,
        accountStatus: 'OPEN',
        balance: 1200,
        creditLimit: 8000,
      })
      .expect(200);
    await request(app)
      .patch(`/reviews/client/${reviewId}/intake`)
      .set('x-test-principal', clientHeader)
      .send({ creditAccountsConfirmed: true, materialChanges: ['No material changes'] })
      .expect(204);
    await request(app)
      .post(`/reviews/client/${reviewId}/submit`)
      .set('x-test-principal', clientHeader)
      .set('Idempotency-Key', `${marker}:submit`)
      .expect(200);
    await request(app)
      .post(`/reviews/client/${reviewId}/submit`)
      .set('x-test-principal', clientHeader)
      .set('Idempotency-Key', `${marker}:submit`)
      .expect(200);

    for (let step = 0; step < 5; step += 1) {
      const job = await prisma.aIJob.findFirstOrThrow({
        where: { correlationId: `credit-review:${reviewId}`, status: 'QUEUED' },
        orderBy: { createdAt: 'asc' },
      });
      const processed = await runtime.processJob(job.id);
      await advanceDurablePhase7Pipeline(runtime, processed);
    }
    expect(
      await prisma.aIJob.count({
        where: { correlationId: `credit-review:${reviewId}`, status: 'SUCCEEDED' },
      }),
    ).toBe(5);
    expect(
      await prisma.reviewCreditTransaction.count({
        where: { reviewId, transactionType: 'CONSUME' },
      }),
    ).toBe(1);

    let workspace = await request(app)
      .get(`/reviews/consultant/${client.id}/${reviewId}/workspace`)
      .set('x-test-principal', consultantHeader)
      .expect(200);
    expect(workspace.body.report.storageKey).toBeUndefined();
    expect(workspace.body.effectiveProfile.experianScore).toBe(721);
    for (const finding of workspace.body.draft.findings as Array<{ code: string }>) {
      await request(app)
        .patch(`/reviews/consultant/${client.id}/${reviewId}/workspace/findings/${finding.code}`)
        .set('x-test-principal', consultantHeader)
        .send({ expectedVersion: workspace.body.draft.version, action: 'APPROVE' })
        .expect(204);
      workspace = await request(app)
        .get(`/reviews/consultant/${client.id}/${reviewId}/workspace`)
        .set('x-test-principal', consultantHeader)
        .expect(200);
    }
    await request(app)
      .put(`/reviews/consultant/${client.id}/${reviewId}/workspace/analysis`)
      .set('x-test-principal', consultantHeader)
      .send({
        expectedVersion: workspace.body.draft.version,
        analysis: {
          clientSummary:
            'The accepted report supports selective progress while utilization remains managed.',
        },
        recommendation: {
          outcome: 'PROCEED_SELECTIVELY',
          clientExplanation: 'Proceed selectively with consultant coordination.',
          reasons: ['Preserve utilization'],
          approved: true,
        },
        approveAnalysis: true,
        approveRecommendation: true,
      })
      .expect(200);
    workspace = await request(app)
      .get(`/reviews/consultant/${client.id}/${reviewId}/workspace`)
      .set('x-test-principal', consultantHeader)
      .expect(200);
    await request(app)
      .get(`/reviews/consultant/${client.id}/${reviewId}/workspace/readiness`)
      .set('x-test-principal', consultantHeader)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ ready: true, blockers: [] }));
    await request(app)
      .post(`/reviews/consultant/${client.id}/${reviewId}/publish`)
      .set('x-test-principal', consultantHeader)
      .set('Idempotency-Key', `${marker}:publish`)
      .send({ expectedDraftVersion: workspace.body.draft.version })
      .expect(200);
    const published = await request(app)
      .get('/credit-profile')
      .set('x-test-principal', clientHeader)
      .expect(200);
    expect(published.body.current.projection.profile.experianScore).toBe(721);
    expect(JSON.stringify(published.body)).not.toMatch(
      /storageKey|confidence|provider|internalDetail|aiProvenance/i,
    );
    expect(await prisma.publishedCreditReview.count({ where: { reviewId } })).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: reviewId, eventType: 'credit_review.published' },
      }),
    ).toBe(1);
  }, 30_000);
});
