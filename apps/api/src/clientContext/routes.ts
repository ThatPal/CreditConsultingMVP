import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import { requireAuth, requireClientAccess, requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const businessInput = z
  .object({
    legalName: z.string().trim().min(1).max(160),
    displayName: z.string().trim().max(160).nullable().optional(),
    entityType: z.string().trim().max(80).nullable().optional(),
    industry: z.string().trim().max(120).nullable().optional(),
    formedAt: z.coerce.date().max(new Date()).nullable().optional(),
    ownershipPercent: z.number().min(0).max(100).nullable().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();

const relationshipInput = z
  .object({
    institutionName: z.string().trim().min(1).max(160),
    relationshipType: z.enum(['CHECKING', 'SAVINGS', 'BUSINESS_BANKING', 'OTHER']),
    relationshipStartedAt: z.coerce.date().max(new Date()).nullable().optional(),
    approximateTenure: z.string().trim().max(80).nullable().optional(),
    clientBusinessId: z.string().uuid().nullable().optional(),
    clientNote: z.string().trim().max(500).nullable().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new AppError('VALIDATION_ERROR', 400, parsed.error.issues[0]?.message ?? 'Invalid input');
  return parsed.data;
}

function key(req: { get(name: string): string | undefined }) {
  const value = req.get('Idempotency-Key');
  if (!value || value.length > 120)
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key is required');
  return value;
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const defined = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

async function ownClient(prisma: PrismaClient, userId: string) {
  const client = await prisma.client.findUnique({ where: { userId }, select: { id: true } });
  if (!client) throw new AppError('NOT_FOUND', 404, 'Client context was not found');
  return client.id;
}

const businessSelect = {
  id: true,
  legalName: true,
  displayName: true,
  entityType: true,
  industry: true,
  formedAt: true,
  ownershipPercent: true,
  status: true,
  version: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientBusinessSelect;

const relationshipSelect = {
  id: true,
  institutionName: true,
  relationshipType: true,
  relationshipStartedAt: true,
  approximateTenure: true,
  clientBusinessId: true,
  clientNote: true,
  status: true,
  version: true,
  closedAt: true,
  lastConfirmedAt: true,
  createdAt: true,
  updatedAt: true,
  clientBusiness: { select: { id: true, displayName: true, legalName: true } },
} satisfies Prisma.ClientFinancialRelationshipSelect;

export function createClientContextRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  denialRecorder?: AuthorizationDenialRecorder,
) {
  const router = Router();

  router.get('/client/context', requireAuth, requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = await ownClient(prisma, req.auth!.userId);
      const context = await prisma.client.findUniqueOrThrow({
        where: { id: clientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          timezone: true,
          user: { select: { email: true } },
          businesses: {
            select: businessSelect,
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          },
          financialRelationships: {
            select: relationshipSelect,
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      res.json({ context });
    } catch (error) {
      next(error);
    }
  });

  router.post('/client/businesses', requireAuth, requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(businessInput.omit({ version: true }), req.body);
      const clientId = await ownClient(prisma, req.auth!.userId);
      const commandKey = key(req);
      const { result, replayed } = await executeConsequentialCommand(prisma, {
        idempotency: {
          scope: 'CLIENT_CONTEXT',
          subjectId: clientId,
          operation: 'CREATE_BUSINESS',
          key: commandKey,
          requestHash: hash(input),
        },
        mutate: async (tx) => {
          const created = await tx.clientBusiness.create({
            data: defined({ clientId, ...input }) as Prisma.ClientBusinessUncheckedCreateInput,
            select: { id: true, version: true },
          });
          return created;
        },
        audit: (result) => ({
          actorId: req.auth!.userId,
          clientId,
          action: 'CLIENT_BUSINESS_CREATED',
          entityType: 'ClientBusiness',
          entityId: result.id,
        }),
        outbox: {
          eventType: 'client.business.created',
          eventKey: `client-business-created:${clientId}:${commandKey}`,
          aggregateType: 'ClientBusiness',
          aggregateId: (result) => result.id,
          payload: (result) => ({ clientId, businessId: result.id, domains: ['client-context'] }),
        },
      });
      const business = await prisma.clientBusiness.findUniqueOrThrow({
        where: { id: result.id },
        select: businessSelect,
      });
      res.status(replayed ? 200 : 201).json({ business, replayed });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    '/client/businesses/:businessId',
    requireAuth,
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const input = parse(businessInput, req.body);
        if (!input.version)
          throw new AppError('VERSION_REQUIRED', 400, 'The current version is required');
        const clientId = await ownClient(prisma, req.auth!.userId);
        const { version, ...data } = input;
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.clientBusiness.updateMany({
            where: {
              id: req.params.businessId as string,
              clientId,
              version,
              status: { not: 'ARCHIVED' },
            },
            data: defined({
              ...data,
              version: { increment: 1 },
            }) as Prisma.ClientBusinessUncheckedUpdateManyInput,
          });
          if (!changed.count)
            throw new AppError(
              'STALE_OR_NOT_FOUND',
              409,
              'Business changed elsewhere or is unavailable',
            );
          const row = await tx.clientBusiness.findUniqueOrThrow({
            where: { id: req.params.businessId as string },
            select: businessSelect,
          });
          await tx.auditEvent.create({
            data: {
              actorId: req.auth!.userId,
              clientId,
              action: 'CLIENT_BUSINESS_UPDATED',
              entityType: 'ClientBusiness',
              entityId: row.id,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'client.business.updated',
              eventKey: `client-business-updated:${row.id}:${row.version}`,
              aggregateType: 'ClientBusiness',
              aggregateId: row.id,
              payload: { clientId, businessId: row.id, domains: ['client-context'] },
            },
          });
          return row;
        });
        res.json({ business: updated });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/client/businesses/:businessId/archive',
    requireAuth,
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const { version } = parse(
          z.object({ version: z.number().int().positive() }).strict(),
          req.body,
        );
        const clientId = await ownClient(prisma, req.auth!.userId);
        await prisma.$transaction(async (tx) => {
          const changed = await tx.clientBusiness.updateMany({
            where: {
              id: req.params.businessId as string,
              clientId,
              version,
              status: { not: 'ARCHIVED' },
            },
            data: { status: 'ARCHIVED', archivedAt: new Date(), version: { increment: 1 } },
          });
          if (!changed.count)
            throw new AppError(
              'STALE_OR_NOT_FOUND',
              409,
              'Business changed elsewhere or is unavailable',
            );
          await tx.auditEvent.create({
            data: {
              actorId: req.auth!.userId,
              clientId,
              action: 'CLIENT_BUSINESS_ARCHIVED',
              entityType: 'ClientBusiness',
              entityId: req.params.businessId as string,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'client.business.archived',
              eventKey: `client-business-archived:${req.params.businessId}:${version}`,
              aggregateType: 'ClientBusiness',
              aggregateId: req.params.businessId as string,
              payload: { clientId, businessId: req.params.businessId, domains: ['client-context'] },
            },
          });
        });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/client/financial-relationships',
    requireAuth,
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const input = parse(relationshipInput.omit({ version: true }), req.body);
        const clientId = await ownClient(prisma, req.auth!.userId);
        if (
          input.clientBusinessId &&
          !(await prisma.clientBusiness.findFirst({
            where: { id: input.clientBusinessId, clientId, status: { not: 'ARCHIVED' } },
            select: { id: true },
          }))
        )
          throw new AppError('INVALID_BUSINESS', 400, 'Related business is unavailable');
        const commandKey = key(req);
        const { result, replayed } = await executeConsequentialCommand(prisma, {
          idempotency: {
            scope: 'CLIENT_CONTEXT',
            subjectId: clientId,
            operation: 'CREATE_FINANCIAL_RELATIONSHIP',
            key: commandKey,
            requestHash: hash(input),
          },
          mutate: async (tx) =>
            tx.clientFinancialRelationship.create({
              data: defined({
                clientId,
                source: 'CLIENT',
                ...input,
              }) as Prisma.ClientFinancialRelationshipUncheckedCreateInput,
              select: { id: true, version: true },
            }),
          audit: (result) => ({
            actorId: req.auth!.userId,
            clientId,
            action: 'CLIENT_FINANCIAL_RELATIONSHIP_CREATED',
            entityType: 'ClientFinancialRelationship',
            entityId: result.id,
          }),
          outbox: {
            eventType: 'client.financial_relationship.created',
            eventKey: `client-financial-created:${clientId}:${commandKey}`,
            aggregateType: 'ClientFinancialRelationship',
            aggregateId: (result) => result.id,
            payload: (result) => ({
              clientId,
              relationshipId: result.id,
              domains: ['client-context'],
            }),
          },
        });
        const relationship = await prisma.clientFinancialRelationship.findUniqueOrThrow({
          where: { id: result.id },
          select: relationshipSelect,
        });
        res.status(replayed ? 200 : 201).json({ relationship, replayed });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    '/client/financial-relationships/:relationshipId',
    requireAuth,
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const input = parse(relationshipInput, req.body);
        if (!input.version)
          throw new AppError('VERSION_REQUIRED', 400, 'The current version is required');
        const clientId = await ownClient(prisma, req.auth!.userId);
        if (
          input.clientBusinessId &&
          !(await prisma.clientBusiness.findFirst({
            where: { id: input.clientBusinessId, clientId, status: { not: 'ARCHIVED' } },
            select: { id: true },
          }))
        )
          throw new AppError('INVALID_BUSINESS', 400, 'Related business is unavailable');
        const { version, ...data } = input;
        const relationship = await prisma.$transaction(async (tx) => {
          const changed = await tx.clientFinancialRelationship.updateMany({
            where: {
              id: req.params.relationshipId as string,
              clientId,
              version,
              status: { not: 'CLOSED' },
            },
            data: defined({
              ...data,
              version: { increment: 1 },
            }) as Prisma.ClientFinancialRelationshipUncheckedUpdateManyInput,
          });
          if (!changed.count)
            throw new AppError(
              'STALE_OR_NOT_FOUND',
              409,
              'Relationship changed elsewhere or is unavailable',
            );
          const row = await tx.clientFinancialRelationship.findUniqueOrThrow({
            where: { id: req.params.relationshipId as string },
            select: relationshipSelect,
          });
          await tx.auditEvent.create({
            data: {
              actorId: req.auth!.userId,
              clientId,
              action: 'CLIENT_FINANCIAL_RELATIONSHIP_UPDATED',
              entityType: 'ClientFinancialRelationship',
              entityId: row.id,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'client.financial_relationship.updated',
              eventKey: `client-financial-updated:${row.id}:${row.version}`,
              aggregateType: 'ClientFinancialRelationship',
              aggregateId: row.id,
              payload: { clientId, relationshipId: row.id, domains: ['client-context'] },
            },
          });
          return row;
        });
        res.json({ relationship });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/client/financial-relationships/:relationshipId/close',
    requireAuth,
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const { version } = parse(
          z.object({ version: z.number().int().positive() }).strict(),
          req.body,
        );
        const clientId = await ownClient(prisma, req.auth!.userId);
        await prisma.$transaction(async (tx) => {
          const changed = await tx.clientFinancialRelationship.updateMany({
            where: {
              id: req.params.relationshipId as string,
              clientId,
              version,
              status: { not: 'CLOSED' },
            },
            data: { status: 'CLOSED', closedAt: new Date(), version: { increment: 1 } },
          });
          if (!changed.count)
            throw new AppError(
              'STALE_OR_NOT_FOUND',
              409,
              'Relationship changed elsewhere or is unavailable',
            );
          await tx.auditEvent.create({
            data: {
              actorId: req.auth!.userId,
              clientId,
              action: 'CLIENT_FINANCIAL_RELATIONSHIP_CLOSED',
              entityType: 'ClientFinancialRelationship',
              entityId: req.params.relationshipId as string,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'client.financial_relationship.closed',
              eventKey: `client-financial-closed:${req.params.relationshipId}:${version}`,
              aggregateType: 'ClientFinancialRelationship',
              aggregateId: req.params.relationshipId as string,
              payload: {
                clientId,
                relationshipId: req.params.relationshipId,
                domains: ['client-context'],
              },
            },
          });
        });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/consultant/client-context',
    requireAuth,
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const input = parse(
          z.object({
            search: z.string().trim().max(120).default(''),
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(50).default(20),
          }),
          req.query,
        );
        const now = new Date();
        const access = {
          OR: [
            {
              staffAssignments: {
                some: {
                  staffUserId: req.auth!.userId,
                  activatedAt: { lte: now },
                  deactivatedAt: null,
                },
              },
            },
            {
              accessGrants: {
                some: {
                  granteeId: req.auth!.userId,
                  startsAt: { lte: now },
                  expiresAt: { gt: now },
                  revokedAt: null,
                  allowedCapabilities: { has: 'client.read' },
                },
              },
            },
          ],
        } satisfies Prisma.ClientWhereInput;
        const search = input.search
          ? {
              OR: [
                { firstName: { contains: input.search, mode: 'insensitive' as const } },
                { lastName: { contains: input.search, mode: 'insensitive' as const } },
                { user: { email: { contains: input.search, mode: 'insensitive' as const } } },
              ],
            }
          : {};
        const where: Prisma.ClientWhereInput = { status: 'ACTIVE', AND: [access, search] };
        const [total, clients] = await prisma.$transaction([
          prisma.client.count({ where }),
          prisma.client.findMany({
            where,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              timezone: true,
              status: true,
              user: { select: { email: true } },
              _count: {
                select: {
                  businesses: { where: { status: 'ACTIVE' } },
                  financialRelationships: { where: { status: 'ACTIVE' } },
                },
              },
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
        ]);
        res.json({
          clients,
          total,
          page: input.page,
          pageSize: input.pageSize,
          hasMore: input.page * input.pageSize < total,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    '/consultant/client-context/:clientId',
    requireAuth,
    requireRole('CONSULTANT'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        const client = await prisma.client.findUnique({
          where: { id: req.params.clientId as string },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            timezone: true,
            status: true,
            createdAt: true,
            user: { select: { email: true } },
            assignedConsultant: { select: { id: true, name: true, email: true } },
            businesses: { select: businessSelect, orderBy: [{ status: 'asc' }, { id: 'asc' }] },
            financialRelationships: {
              select: relationshipSelect,
              orderBy: [{ status: 'asc' }, { id: 'asc' }],
            },
          },
        });
        if (!client) throw new AppError('NOT_FOUND', 404, 'Client was not found');
        res.json({ client });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
