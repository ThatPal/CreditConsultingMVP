import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import type { DocumentStorageRegistry } from '../storage/documentStorage.js';

const typeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9_]+$/);
const maximumUploadBytes = 10 * 1024 * 1024;
const documentListQuery = z.object({
  search: z.string().trim().max(120).optional(),
  type: typeKeySchema.optional(),
  status: z.enum(['AVAILABLE', 'SUPERSEDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export function sanitizeDocumentFileName(input: string) {
  const decoded = (() => {
    try {
      return decodeURIComponent(input);
    } catch {
      return input;
    }
  })();
  const name = decoded
    .replace(/[\r\n\0]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^\p{L}\p{N}._ ()-]/gu, '_')
    .trim()
    .replace(/^[._-]+/, '')
    .slice(0, 180);
  if (!name) throw new AppError('INVALID_FILE_NAME', 400, 'A safe file name is required');
  return name;
}

function extensionOf(name: string) {
  const index = name.lastIndexOf('.');
  return index < 0 ? '' : name.slice(index).toLowerCase();
}

function present(document: {
  id: string;
  originalFileName: string;
  displayFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: string;
  clientVisible: boolean;
  uploadedAt: Date;
  supersededAt: Date | null;
  documentType: { key: string; name: string };
}) {
  return {
    id: document.id,
    originalFileName: document.originalFileName,
    displayFileName: document.displayFileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    status: document.status,
    clientVisible: document.clientVisible,
    uploadedAt: document.uploadedAt,
    supersededAt: document.supersededAt,
    documentType: document.documentType,
  };
}

async function canRead(
  authorization: AuthorizationService,
  principal: AuthPrincipal,
  clientId: string,
  clientVisible: boolean,
) {
  if (principal.role === 'CLIENT' && !clientVisible) return false;
  return authorization.authorize(principal, 'document.read', { type: 'client', clientId });
}

export function createDocumentRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  storageRegistry: DocumentStorageRegistry,
) {
  const router = Router();

  router.get('/types', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const types = await prisma.documentType.findMany({
        where: {
          enabled: true,
          ...(req.auth.role === 'CLIENT' ? { clientUploadEnabled: true } : {}),
        },
        orderBy: { name: 'asc' },
        select: {
          key: true,
          name: true,
          allowedMimeTypes: true,
          allowedExtensions: true,
          maximumSizeBytes: true,
          clientUploadEnabled: true,
        },
      });
      res.json({ documentTypes: types });
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      if (req.auth.role !== 'CLIENT' || !req.auth.clientId)
        throw new AppError('FORBIDDEN', 403, 'Use a client-scoped document query');
      const allowed = await authorization.authorize(req.auth, 'document.read', {
        type: 'client',
        clientId: req.auth.clientId,
      });
      if (!allowed) throw new AppError('FORBIDDEN', 403, 'Document access is not permitted');
      const query = documentListQuery.parse(req.query);
      const where = {
        clientId: req.auth.clientId,
        clientVisible: true,
        status: query.status ?? { not: 'DELETED' as const },
        ...(query.type ? { documentType: { key: query.type } } : {}),
        ...(query.search
          ? {
              OR: [
                { displayFileName: { contains: query.search, mode: 'insensitive' as const } },
                { originalFileName: { contains: query.search, mode: 'insensitive' as const } },
                { documentType: { name: { contains: query.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };
      const [documents, total] = await prisma.$transaction([
        prisma.document.findMany({
        where: {
          ...where,
        },
        include: { documentType: { select: { key: true, name: true } } },
        orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
        prisma.document.count({ where }),
      ]);
      res.json({
        documents: documents.map(present),
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasMore: query.page * query.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/client/:clientId', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const clientId = req.params.clientId as string;
      if (!(await authorization.authorize(req.auth, 'document.read', { type: 'client', clientId })))
        throw new AppError('NOT_FOUND', 404, 'Document collection was not found');
      const documents = await prisma.document.findMany({
        where: { clientId, status: { not: 'DELETED' } },
        include: { documentType: { select: { key: true, name: true } } },
        orderBy: { uploadedAt: 'desc' },
      });
      res.json({ documents: documents.map(present) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/',
    express.raw({ type: () => true, limit: maximumUploadBytes }),
    async (req, res, next) => {
      let storageKey: string | null = null;
      let cleanupStorage: ReturnType<DocumentStorageRegistry['forNewUpload']> | null = null;
      try {
        if (!req.auth?.clientId || req.auth.role !== 'CLIENT')
          throw new AppError('FORBIDDEN', 403, 'Client document upload is required');
        const clientId = req.auth.clientId;
        if (
          !(await authorization.authorize(req.auth, 'document.manage', {
            type: 'client',
            clientId,
          }))
        )
          throw new AppError('FORBIDDEN', 403, 'Document upload is not permitted');
        if (!Buffer.isBuffer(req.body) || req.body.length === 0)
          throw new AppError('EMPTY_DOCUMENT', 400, 'The document cannot be empty');
        const typeKey = typeKeySchema.parse(req.get('x-document-type'));
        const originalFileName = sanitizeDocumentFileName(req.get('x-file-name') ?? '');
        const mimeType = (req.get('content-type') ?? 'application/octet-stream')
          .split(';')[0]!
          .toLowerCase();
        const documentType = await prisma.documentType.findUnique({ where: { key: typeKey } });
        if (!documentType?.enabled || !documentType.clientUploadEnabled)
          throw new AppError('DOCUMENT_TYPE_NOT_AVAILABLE', 400, 'Document type is not available');
        if (!documentType.allowedMimeTypes.includes(mimeType))
          throw new AppError('DOCUMENT_MIME_NOT_ALLOWED', 415, 'Document type is not allowed');
        if (!documentType.allowedExtensions.includes(extensionOf(originalFileName)))
          throw new AppError(
            'DOCUMENT_EXTENSION_NOT_ALLOWED',
            415,
            'File extension is not allowed',
          );
        if (req.body.length > documentType.maximumSizeBytes)
          throw new AppError('DOCUMENT_TOO_LARGE', 413, 'Document exceeds the allowed size');

        const documentId = randomUUID();
        storageKey = `documents/${clientId}/${documentId}`;
        const uploadStorage = storageRegistry.forNewUpload();
        cleanupStorage = uploadStorage;
        const stored = await uploadStorage.put(storageKey, req.body);
        const retainUntil = documentType.retentionDays
          ? new Date(Date.now() + documentType.retentionDays * 86_400_000)
          : null;
        const document = await prisma.$transaction(async (tx) => {
          const created = await tx.document.create({
            data: {
              id: documentId,
              clientId,
              documentTypeId: documentType.id,
              originalFileName,
              displayFileName: originalFileName,
              mimeType,
              sizeBytes: stored.sizeBytes,
              sha256: stored.sha256,
              storageProvider: stored.provider,
              storageKey: stored.storageKey,
              clientVisible: documentType.clientVisible,
              uploadedByUserId: req.auth!.userId,
              retentionCategory: documentType.retentionCategory,
              retainUntil,
            },
            include: { documentType: { select: { key: true, name: true } } },
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'DOCUMENT_CREATED',
              entityType: 'Document',
              entityId: created.id,
              metadata: {
                documentTypeKey: documentType.key,
                mimeType,
                sizeBytes: stored.sizeBytes,
              },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'document.created',
              eventKey: `document.created:${created.id}`,
              aggregateType: 'Document',
              aggregateId: created.id,
              payload: { clientId, domains: ['documents'] },
            },
          });
          return created;
        });
        res.status(201).json({ document: present(document) });
      } catch (error) {
        if (storageKey && cleanupStorage)
          await cleanupStorage.delete(storageKey).catch(() => undefined);
        next(
          error instanceof z.ZodError
            ? new AppError('INVALID_DOCUMENT_TYPE', 400, 'Invalid document type')
            : error,
        );
      }
    },
  );

  router.get('/:documentId/content', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const document = await prisma.document.findUnique({
        where: { id: req.params.documentId as string },
      });
      if (
        !document ||
        document.status === 'DELETED' ||
        !(await canRead(authorization, req.auth, document.clientId, document.clientVisible))
      )
        throw new AppError('NOT_FOUND', 404, 'Document was not found');
      const stream = await storageRegistry
        .forProvider(document.storageProvider)
        .openRead(document.storageKey);
      if (!stream) throw new AppError('DOCUMENT_FILE_MISSING', 404, 'Document file is unavailable');
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Length', String(document.sizeBytes));
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${document.displayFileName.replace(/["\\]/g, '_')}"`,
      );
      res.setHeader('Cache-Control', 'private, no-store');
      stream.on('error', next).pipe(res);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/:documentId/replace',
    express.raw({ type: () => true, limit: maximumUploadBytes }),
    async (req, res, next) => {
      let storageKey: string | null = null;
      let cleanupStorage: ReturnType<DocumentStorageRegistry['forNewUpload']> | null = null;
      try {
        if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
        const prior = await prisma.document.findUnique({
          where: { id: req.params.documentId as string },
          include: { documentType: true },
        });
        if (
          !prior ||
          prior.status !== 'AVAILABLE' ||
          !(await authorization.authorize(req.auth, 'document.manage', {
            type: 'client',
            clientId: prior.clientId,
          }))
        )
          throw new AppError('NOT_FOUND', 404, 'Document was not found');
        if (!Buffer.isBuffer(req.body) || req.body.length === 0)
          throw new AppError('EMPTY_DOCUMENT', 400, 'The document cannot be empty');
        const originalFileName = sanitizeDocumentFileName(req.get('x-file-name') ?? '');
        const mimeType = (req.get('content-type') ?? 'application/octet-stream')
          .split(';')[0]!
          .toLowerCase();
        if (!prior.documentType.allowedMimeTypes.includes(mimeType))
          throw new AppError('DOCUMENT_MIME_NOT_ALLOWED', 415, 'Document type is not allowed');
        if (!prior.documentType.allowedExtensions.includes(extensionOf(originalFileName)))
          throw new AppError(
            'DOCUMENT_EXTENSION_NOT_ALLOWED',
            415,
            'File extension is not allowed',
          );
        if (req.body.length > prior.documentType.maximumSizeBytes)
          throw new AppError('DOCUMENT_TOO_LARGE', 413, 'Document exceeds the allowed size');

        const replacementId = randomUUID();
        storageKey = `documents/${prior.clientId}/${replacementId}`;
        const uploadStorage = storageRegistry.forNewUpload();
        cleanupStorage = uploadStorage;
        const stored = await uploadStorage.put(storageKey, req.body);
        const replacement = await prisma.$transaction(async (tx) => {
          const created = await tx.document.create({
            data: {
              id: replacementId,
              clientId: prior.clientId,
              documentTypeId: prior.documentTypeId,
              originalFileName,
              displayFileName: originalFileName,
              mimeType,
              sizeBytes: stored.sizeBytes,
              sha256: stored.sha256,
              storageProvider: stored.provider,
              storageKey: stored.storageKey,
              clientVisible: prior.clientVisible,
              uploadedByUserId: req.auth!.userId,
              retentionCategory: prior.retentionCategory,
              retainUntil: prior.retainUntil,
            },
            include: { documentType: { select: { key: true, name: true } } },
          });
          await tx.document.update({
            where: { id: prior.id },
            data: { status: 'SUPERSEDED', supersededAt: new Date(), supersededById: created.id },
          });
          await tx.auditEvent.create({
            data: {
              clientId: prior.clientId,
              actorId: req.auth!.userId,
              action: 'DOCUMENT_REPLACED',
              entityType: 'Document',
              entityId: prior.id,
              metadata: { replacementDocumentId: created.id },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'document.replaced',
              eventKey: `document.replaced:${prior.id}:${created.id}`,
              aggregateType: 'Document',
              aggregateId: created.id,
              payload: { clientId: prior.clientId, domains: ['documents'] },
            },
          });
          return created;
        });
        res.status(201).json({ document: present(replacement) });
      } catch (error) {
        if (storageKey && cleanupStorage)
          await cleanupStorage.delete(storageKey).catch(() => undefined);
        next(error);
      }
    },
  );

  router.delete('/:documentId', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const document = await prisma.document.findUnique({
        where: { id: req.params.documentId as string },
      });
      if (
        !document ||
        document.status === 'DELETED' ||
        !(await authorization.authorize(req.auth, 'document.manage', {
          type: 'client',
          clientId: document.clientId,
        }))
      )
        throw new AppError('NOT_FOUND', 404, 'Document was not found');
      if (document.retentionHoldAt)
        throw new AppError('DOCUMENT_RETENTION_HOLD', 409, 'Document is subject to retention hold');
      const recordStorage = storageRegistry.forProvider(document.storageProvider);
      await prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: document.id },
          data: { status: 'DELETED', deletedAt: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            clientId: document.clientId,
            actorId: req.auth!.userId,
            action: 'DOCUMENT_DELETED',
            entityType: 'Document',
            entityId: document.id,
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: 'document.deleted',
            eventKey: `document.deleted:${document.id}`,
            aggregateType: 'Document',
            aggregateId: document.id,
            payload: { clientId: document.clientId, domains: ['documents'] },
          },
        });
      });
      await recordStorage.delete(document.storageKey);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
