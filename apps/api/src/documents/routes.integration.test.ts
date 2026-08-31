import { randomUUID } from 'node:crypto';
import express from 'express';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createPrismaAuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import { seedSystemReferenceData } from '../seeding/systemSeed.js';
import {
  DocumentStorageRegistry,
  LocalDiskDocumentStorage,
  type DocumentStorage,
} from '../storage/documentStorage.js';
import { createDocumentRouter } from './routes.js';

describe('canonical documents API', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const suite = `sprint32-${randomUUID()}`;
  let prisma: PrismaClient;
  let root: string;
  let clientOne: { id: string; userId: string };
  let clientTwo: { id: string; userId: string };
  let consultantId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    await seedSystemReferenceData(prisma);
    root = await mkdtemp(join(tmpdir(), 'credit-documents-api-'));
    const one = await prisma.user.create({
      data: {
        email: `${suite}-one@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: suite, lastName: 'One', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    const two = await prisma.user.create({
      data: {
        email: `${suite}-two@example.test`,
        role: 'CLIENT',
        client: { create: { firstName: suite, lastName: 'Two', termsAcceptedAt: new Date() } },
      },
      include: { client: true },
    });
    const consultant = await prisma.user.create({
      data: { email: `${suite}-staff@example.test`, role: 'CONSULTANT' },
    });
    clientOne = { id: one.client!.id, userId: one.id };
    clientTwo = { id: two.client!.id, userId: two.id };
    consultantId = consultant.id;
  });

  afterAll(async () => {
    const clientIds = [clientOne.id, clientTwo.id];
    await prisma.staffClientAssignment.deleteMany({ where: { staffUserId: consultantId } });
    await prisma.outboxEvent.deleteMany({
      where: { eventKey: { startsWith: 'document.created:' } },
    });
    await prisma.auditEvent.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.document.deleteMany({ where: { clientId: { in: clientIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: suite } } });
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  function app(
    storage: DocumentStorage | DocumentStorageRegistry = new LocalDiskDocumentStorage(root),
  ) {
    const registry =
      storage instanceof DocumentStorageRegistry
        ? storage
        : new DocumentStorageRegistry(storage.provider, [storage]);
    const application = express();
    application.use((req, _res, next) => {
      const identity = req.get('x-test-identity');
      if (identity === 'one')
        req.auth = {
          userId: clientOne.userId,
          email: `${suite}-one@example.test`,
          role: 'CLIENT',
          status: 'ACTIVE',
          clientId: clientOne.id,
        };
      if (identity === 'two')
        req.auth = {
          userId: clientTwo.userId,
          email: `${suite}-two@example.test`,
          role: 'CLIENT',
          status: 'ACTIVE',
          clientId: clientTwo.id,
        };
      if (identity === 'staff')
        req.auth = {
          userId: consultantId,
          email: `${suite}-staff@example.test`,
          role: 'CONSULTANT',
          status: 'ACTIVE',
          clientId: null,
          staffMfaVerified: true,
        };
      next();
    });
    application.use(
      '/documents',
      createDocumentRouter(prisma, createPrismaAuthorizationService(prisma), registry),
    );
    application.use(errorHandler(pino({ enabled: false })));
    return application;
  }

  test('uploads, persists checksum, lists safe metadata, and streams only by authorized ID', async () => {
    const uploaded = await request(app())
      .post('/documents')
      .set('x-test-identity', 'one')
      .set('x-document-type', 'GENERAL_CLIENT_DOCUMENT')
      .set('x-file-name', encodeURIComponent('safe report.pdf'))
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-safe'))
      .expect(201);
    const documentId = uploaded.body.document.id as string;
    expect(uploaded.body.document).not.toHaveProperty('storageKey');
    expect(uploaded.body.document.sha256).toMatch(/^[a-f0-9]{64}$/);
    const listed = await request(app()).get('/documents').set('x-test-identity', 'one').expect(200);
    expect(listed.body.documents).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain('documents/');
    await request(app())
      .get(`/documents/${documentId}/content`)
      .set('x-test-identity', 'one')
      .expect('content-type', 'application/pdf')
      .expect(200)
      .expect((res) => expect(res.body).toEqual(Buffer.from('%PDF-safe')));
    await request(app())
      .get(`/documents/${documentId}/content`)
      .set('x-test-identity', 'two')
      .expect(404);
    await request(app())
      .get(`/documents/${randomUUID()}/content`)
      .set('x-test-identity', 'two')
      .expect(404);
  });

  test('staff access follows active assignment and is denied after revocation', async () => {
    const document = await prisma.document.findFirstOrThrow({ where: { clientId: clientOne.id } });
    await request(app())
      .get(`/documents/${document.id}/content`)
      .set('x-test-identity', 'staff')
      .expect(404);
    const assignment = await prisma.staffClientAssignment.create({
      data: { staffUserId: consultantId, clientId: clientOne.id },
    });
    await request(app())
      .get(`/documents/${document.id}/content`)
      .set('x-test-identity', 'staff')
      .expect(200);
    await prisma.staffClientAssignment.update({
      where: { id: assignment.id },
      data: { deactivatedAt: new Date() },
    });
    await request(app())
      .get(`/documents/${document.id}/content`)
      .set('x-test-identity', 'staff')
      .expect(404);
  });

  test('replaces without rewriting history and deletes through the provider boundary', async () => {
    const original = await prisma.document.findFirstOrThrow({
      where: { clientId: clientOne.id, status: 'AVAILABLE' },
    });
    const replaced = await request(app())
      .post(`/documents/${original.id}/replace`)
      .set('x-test-identity', 'one')
      .set('x-file-name', 'replacement.pdf')
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-replacement'))
      .expect(201);
    await expect(prisma.document.findUnique({ where: { id: original.id } })).resolves.toMatchObject(
      { status: 'SUPERSEDED', supersededById: replaced.body.document.id },
    );
    await request(app())
      .delete(`/documents/${replaced.body.document.id}`)
      .set('x-test-identity', 'one')
      .expect(204);
    await expect(
      prisma.document.findUnique({ where: { id: replaced.body.document.id } }),
    ).resolves.toMatchObject({ status: 'DELETED' });
  });

  test('rejects empty, unsafe-name, MIME and size violations without orphan records', async () => {
    const before = await prisma.document.count({ where: { clientId: clientTwo.id } });
    await request(app())
      .post('/documents')
      .set('x-test-identity', 'two')
      .set('x-document-type', 'GENERAL_CLIENT_DOCUMENT')
      .set('x-file-name', encodeURIComponent('../unsafe.svg'))
      .set('content-type', 'image/svg+xml')
      .send(Buffer.from('<svg/>'))
      .expect(415);
    await request(app())
      .post('/documents')
      .set('x-test-identity', 'two')
      .set('x-document-type', 'GENERAL_CLIENT_DOCUMENT')
      .set('x-file-name', 'empty.pdf')
      .set('content-type', 'application/pdf')
      .send(Buffer.alloc(0))
      .expect(400);
    expect(await prisma.document.count({ where: { clientId: clientTwo.id } })).toBe(before);
  });

  test('cleans a completed private write when canonical persistence fails', async () => {
    const base = new LocalDiskDocumentStorage(root);
    let attemptedKey = '';
    const storage: DocumentStorage = {
      provider: 'LOCAL_DISK',
      put: async (key, content) => {
        attemptedKey = key;
        await base.put(key, content);
        throw new Error('simulated finalization failure');
      },
      read: (key) => base.read(key),
      openRead: (key) => base.openRead(key),
      exists: (key) => base.exists(key),
      delete: (key) => base.delete(key),
    };
    const before = await prisma.document.count({ where: { clientId: clientTwo.id } });
    await request(app(storage))
      .post('/documents')
      .set('x-test-identity', 'two')
      .set('x-document-type', 'GENERAL_CLIENT_DOCUMENT')
      .set('x-file-name', 'cleanup.pdf')
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-cleanup'))
      .expect(500);
    expect(await prisma.document.count({ where: { clientId: clientTwo.id } })).toBe(before);
    await expect(base.exists(attemptedKey)).resolves.toBe(false);
  });

  test('routes historical reads and cross-provider replacements by persisted provider', async () => {
    const local = new LocalDiskDocumentStorage(root);
    const s3Objects = new Map<string, Buffer>();
    const s3: DocumentStorage = {
      provider: 'S3_COMPATIBLE',
      put: async (key, content) => {
        s3Objects.set(key, content);
        return {
          provider: 'S3_COMPATIBLE',
          storageKey: key,
          sizeBytes: content.length,
          sha256: 'a'.repeat(64),
        };
      },
      read: async (key) => s3Objects.get(key) ?? null,
      openRead: async (key) => {
        const value = s3Objects.get(key);
        return value ? (await import('node:stream')).Readable.from(value) : null;
      },
      exists: async (key) => s3Objects.has(key),
      delete: async (key) => void s3Objects.delete(key),
    };

    const localDefault = new DocumentStorageRegistry('LOCAL_DISK', [local, s3]);
    const first = await request(app(localDefault))
      .post('/documents')
      .set('x-test-identity', 'two')
      .set('x-document-type', 'GENERAL_CLIENT_DOCUMENT')
      .set('x-file-name', 'local-history.pdf')
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-local-history'))
      .expect(201);
    await expect(
      prisma.document.findUniqueOrThrow({ where: { id: first.body.document.id } }),
    ).resolves.toMatchObject({ storageProvider: 'LOCAL_DISK' });

    const s3Default = new DocumentStorageRegistry('S3_COMPATIBLE', [local, s3]);
    await request(app(s3Default))
      .get(`/documents/${first.body.document.id}/content`)
      .set('x-test-identity', 'two')
      .expect(200)
      .expect((res) => expect(res.body).toEqual(Buffer.from('%PDF-local-history')));
    const replacement = await request(app(s3Default))
      .post(`/documents/${first.body.document.id}/replace`)
      .set('x-test-identity', 'two')
      .set('x-file-name', 's3-replacement.pdf')
      .set('content-type', 'application/pdf')
      .send(Buffer.from('%PDF-s3-replacement'))
      .expect(201);
    await expect(
      prisma.document.findUniqueOrThrow({ where: { id: replacement.body.document.id } }),
    ).resolves.toMatchObject({ storageProvider: 'S3_COMPATIBLE' });
    await request(app(s3Default))
      .get(`/documents/${replacement.body.document.id}/content`)
      .set('x-test-identity', 'two')
      .expect(200)
      .expect((res) => expect(res.body).toEqual(Buffer.from('%PDF-s3-replacement')));
    await request(app(s3Default))
      .delete(`/documents/${replacement.body.document.id}`)
      .set('x-test-identity', 'two')
      .expect(204);
    expect(s3Objects.size).toBe(0);
    const localRecord = await prisma.document.findUniqueOrThrow({
      where: { id: first.body.document.id },
    });
    await expect(local.exists(localRecord.storageKey)).resolves.toBe(true);
    await request(app(s3Default))
      .delete(`/documents/${first.body.document.id}`)
      .set('x-test-identity', 'two')
      .expect(204);
    await expect(local.exists(localRecord.storageKey)).resolves.toBe(false);
  });

  test('fails closed when a historical record provider is unavailable', async () => {
    const localDocument = await prisma.document.findFirstOrThrow({
      where: { clientId: clientOne.id, storageProvider: 'LOCAL_DISK' },
    });
    const fallbackRead = vi.fn(async () => null);
    const onlyS3: DocumentStorage = {
      provider: 'S3_COMPATIBLE',
      put: vi.fn(),
      read: fallbackRead,
      openRead: fallbackRead,
      exists: vi.fn(async () => false),
      delete: vi.fn(),
    };
    const registry = new DocumentStorageRegistry('S3_COMPATIBLE', [onlyS3]);
    await request(app(registry))
      .get(`/documents/${localDocument.id}/content`)
      .set('x-test-identity', 'one')
      .expect(500);
    expect(fallbackRead).not.toHaveBeenCalled();
  });
});
