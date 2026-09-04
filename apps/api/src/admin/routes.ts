import { Router } from 'express';
import { z } from 'zod';
import {
  requireCanonicalCapability,
  requireRole,
  type AuthorizationDenialRecorder,
} from '../auth/middleware.js';
import { createAccessAdministration } from '../authorization/accessAdministration.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const pageQuery = z.object({
  search: z.string().trim().max(120).default(''),
  role: z.enum(['CLIENT', 'CONSULTANT', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'INVITED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const idempotencyKey = (header: string | undefined) => {
  const value = header?.trim();
  if (!value || value.length < 8 || value.length > 160)
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key is required');
  return value;
};

const sensitiveMetadataKey =
  /(password|token|secret|authorization|cookie|card.?number|file.?content)/i;
export function redactMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetadata);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveMetadataKey.test(key) ? '[REDACTED]' : redactMetadata(item),
    ]),
  );
}

const eventQuery = z.object({
  search: z.string().trim().max(120).default(''),
  action: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  clientId: z.uuid().optional(),
  severity: z.enum(['INFO', 'WARNING', 'HIGH']).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function createAdminOperationsRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  denialRecorder?: AuthorizationDenialRecorder,
) {
  const router = Router();
  const access = createAccessAdministration(prisma);
  const canRead = requireCanonicalCapability(
    authorization,
    'settings.manage',
    undefined,
    denialRecorder,
  );
  const canChange = requireCanonicalCapability(
    authorization,
    'settings.manage',
    { requireStepUp: true },
    denialRecorder,
  );
  router.use(requireRole('ADMIN'));

  router.get('/users', canRead, async (req, res, next) => {
    try {
      const input = pageQuery.parse(req.query);
      const where: Prisma.UserWhereInput = {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { email: { contains: input.search, mode: 'insensitive' } },
                { name: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [total, users] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            twoFactorEnabled: true,
            lastLoginAt: true,
            updatedAt: true,
            _count: {
              select: { betterAuthSessions: true, accessGrants: true, staffAssignments: true },
            },
          },
          orderBy: [{ role: 'asc' }, { email: 'asc' }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({
        users,
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: input.page * input.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users/:userId', canRead, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId as string },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          betterAuthSessions: {
            select: {
              id: true,
              createdAt: true,
              updatedAt: true,
              expiresAt: true,
              ipAddress: true,
              userAgent: true,
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
            take: 50,
          },
          accessGrants: {
            select: {
              id: true,
              clientId: true,
              scope: true,
              startsAt: true,
              expiresAt: true,
              revokedAt: true,
              reason: true,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 50,
          },
          staffAssignments: {
            select: { id: true, clientId: true, activatedAt: true, deactivatedAt: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            take: 50,
          },
        },
      });
      if (!user) throw new AppError('NOT_FOUND', 404, 'User was not found');
      const capabilities = await prisma.roleCapability.findMany({
        where: { role: user.role },
        select: { capability: true },
        orderBy: { capability: 'asc' },
      });
      res.json({ user: { ...user, capabilities: capabilities.map((item) => item.capability) } });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/users/:userId/role', canChange, async (req, res, next) => {
    try {
      const input = z
        .object({ role: z.enum(['CONSULTANT', 'ADMIN']), expectedUpdatedAt: z.coerce.date() })
        .parse(req.body);
      const userId = req.params.userId as string;
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, updatedAt: true },
      });
      if (!target) throw new AppError('NOT_FOUND', 404, 'User was not found');
      if (target.updatedAt.getTime() !== input.expectedUpdatedAt.getTime())
        throw new AppError('STALE_USER', 409, 'The user changed; refresh before continuing');
      if (req.auth!.userId === userId && target.role === 'ADMIN' && input.role !== 'ADMIN')
        throw new AppError('SELF_LOCKOUT_BLOCKED', 409, 'You cannot remove your own Admin role');
      if (
        target.role === 'ADMIN' &&
        input.role !== 'ADMIN' &&
        (await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } })) <= 1
      )
        throw new AppError('LAST_ADMIN_BLOCKED', 409, 'The last active Admin cannot be removed');
      const commandKey = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{
        id: string;
        role: string;
        previousRole: string;
      }>(prisma, {
        idempotency: {
          scope: 'admin-identity',
          subjectId: userId,
          operation: 'change-role',
          key: commandKey,
        },
        audit: (changed) => ({
          actorId: req.auth!.userId,
          action: 'ADMIN_USER_ROLE_CHANGED',
          entityType: 'User',
          entityId: userId,
          metadata: { previousRole: changed.previousRole, role: changed.role },
        }),
        outbox: {
          eventType: 'authorization.user-role-changed',
          eventKey: commandKey,
          aggregateType: 'User',
          aggregateId: userId,
          payload: { userId, domains: ['authorization', 'sessions'] },
        },
        mutate: async (tx) => {
          const changed = await tx.user.updateMany({
            where: { id: userId, updatedAt: input.expectedUpdatedAt },
            data: { role: input.role },
          });
          if (changed.count !== 1)
            throw new AppError('STALE_USER', 409, 'The user changed; refresh before continuing');
          await tx.betterAuthSession.deleteMany({ where: { userId } });
          await tx.securityEvent.create({
            data: {
              actorId: req.auth!.userId,
              eventType: 'ADMIN_USER_ROLE_CHANGED',
              severity: 'HIGH',
              category: 'AUTHORIZATION',
              entityType: 'User',
              entityId: userId,
              metadata: { previousRole: target.role, role: input.role },
            },
          });
          return { id: userId, role: input.role, previousRole: target.role };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/users/:userId/sessions/:sessionId', canChange, async (req, res, next) => {
    try {
      const userId = req.params.userId as string;
      const sessionId = req.params.sessionId as string;
      const session = await prisma.betterAuthSession.findFirst({
        where: { id: sessionId, userId },
        select: { id: true },
      });
      if (!session) throw new AppError('NOT_FOUND', 404, 'Session was not found');
      const commandKey = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string }>(prisma, {
        idempotency: {
          scope: 'admin-identity',
          subjectId: userId,
          operation: 'revoke-session',
          key: commandKey,
        },
        audit: {
          actorId: req.auth!.userId,
          action: 'ADMIN_SESSION_REVOKED',
          entityType: 'BetterAuthSession',
          entityId: sessionId,
        },
        outbox: {
          eventType: 'authorization.session-revoked',
          eventKey: commandKey,
          aggregateType: 'User',
          aggregateId: userId,
          payload: { userId, domains: ['authorization', 'sessions'] },
        },
        mutate: async (tx) => {
          await tx.betterAuthSession.delete({ where: { id: sessionId } });
          await tx.securityEvent.create({
            data: {
              actorId: req.auth!.userId,
              eventType: 'ADMIN_SESSION_REVOKED',
              severity: 'HIGH',
              category: 'SESSION',
              entityType: 'User',
              entityId: userId,
            },
          });
          return { id: sessionId };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/users/:userId/mfa-reset', canChange, async (req, res, next) => {
    try {
      const userId = req.params.userId as string;
      if (req.auth!.userId === userId)
        throw new AppError(
          'SELF_MFA_RESET_BLOCKED',
          409,
          'Use account recovery to reset your own MFA',
        );
      const commandKey = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string }>(prisma, {
        idempotency: {
          scope: 'admin-identity',
          subjectId: userId,
          operation: 'mfa-reset',
          key: commandKey,
        },
        audit: {
          actorId: req.auth!.userId,
          action: 'ADMIN_MFA_RESET',
          entityType: 'User',
          entityId: userId,
        },
        outbox: {
          eventType: 'authorization.mfa-reset',
          eventKey: commandKey,
          aggregateType: 'User',
          aggregateId: userId,
          payload: { userId, domains: ['authorization', 'sessions'] },
        },
        mutate: async (tx) => {
          const target = await tx.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          if (!target || target.role === 'CLIENT')
            throw new AppError('NOT_FOUND', 404, 'Staff user was not found');
          await tx.betterAuthTwoFactor.deleteMany({ where: { userId } });
          await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
          await tx.betterAuthSession.deleteMany({ where: { userId } });
          await tx.securityEvent.create({
            data: {
              actorId: req.auth!.userId,
              eventType: 'ADMIN_MFA_RESET',
              severity: 'HIGH',
              category: 'MFA',
              entityType: 'User',
              entityId: userId,
            },
          });
          return { id: userId };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/access-grants', canRead, async (req, res, next) => {
    try {
      const input = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const [total, grants] = await prisma.$transaction([
        prisma.clientAccessGrant.count(),
        prisma.clientAccessGrant.findMany({
          include: {
            grantee: { select: { name: true, email: true } },
            client: { select: { firstName: true, lastName: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({
        grants,
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: input.page * input.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit-events', canRead, async (req, res, next) => {
    try {
      const input = eventQuery.parse(req.query);
      const events = await prisma.auditEvent.findMany({
        where: {
          ...(input.action ? { action: input.action } : {}),
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.search
            ? {
                OR: [
                  { action: { contains: input.search, mode: 'insensitive' as const } },
                  { entityType: { contains: input.search, mode: 'insensitive' as const } },
                  { entityId: { contains: input.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          actorId: true,
          clientId: true,
          source: true,
          requestId: true,
          correlationId: true,
          createdAt: true,
          actor: { select: { email: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
      });
      const hasMore = events.length > input.limit;
      const page = events.slice(0, input.limit);
      res.json({ events: page, hasMore, nextCursor: hasMore ? page.at(-1)?.id : null });
    } catch (error) {
      next(error);
    }
  });

  router.get('/audit-events/:eventId', canRead, async (req, res, next) => {
    try {
      const event = await prisma.auditEvent.findUnique({
        where: { id: req.params.eventId as string },
        include: { actor: { select: { email: true, name: true } } },
      });
      if (!event) throw new AppError('NOT_FOUND', 404, 'Audit event was not found');
      res.json({ event: { ...event, metadata: redactMetadata(event.metadata) } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/security-events', canRead, async (req, res, next) => {
    try {
      const input = eventQuery.parse(req.query);
      const events = await prisma.securityEvent.findMany({
        where: {
          ...(input.severity ? { severity: input.severity } : {}),
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.action ? { eventType: input.action } : {}),
          ...(input.search
            ? {
                OR: [
                  { eventType: { contains: input.search, mode: 'insensitive' as const } },
                  { category: { contains: input.search, mode: 'insensitive' as const } },
                  { entityType: { contains: input.search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          eventType: true,
          severity: true,
          category: true,
          entityType: true,
          entityId: true,
          actorId: true,
          clientId: true,
          createdAt: true,
          actor: { select: { email: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
      });
      const hasMore = events.length > input.limit;
      const page = events.slice(0, input.limit);
      res.json({ events: page, hasMore, nextCursor: hasMore ? page.at(-1)?.id : null });
    } catch (error) {
      next(error);
    }
  });

  router.get('/security-events/:eventId', canRead, async (req, res, next) => {
    try {
      const event = await prisma.securityEvent.findUnique({
        where: { id: req.params.eventId as string },
        include: { actor: { select: { email: true, name: true } } },
      });
      if (!event) throw new AppError('NOT_FOUND', 404, 'Security event was not found');
      res.json({ event: { ...event, metadata: redactMetadata(event.metadata) } });
    } catch (error) {
      next(error);
    }
  });

  router.post('/access-grants', canChange, async (req, res, next) => {
    try {
      const input = z
        .object({
          granteeId: z.uuid(),
          clientId: z.uuid(),
          scope: z.enum(['READ', 'CONSULTANT_WORK', 'SUPPORT_ONLY']),
          capabilities: z
            .array(
              z.enum([
                'client.read',
                'client.manage',
                'review.read',
                'review.publish',
                'support.read',
                'support.manage',
                'document.read',
                'document.manage',
                'settings.manage',
                'commerce.manage',
                'payment.read',
                'payment.manage',
                'catalog.read',
                'catalog.manage',
                'strategy.read',
                'strategy.manage',
                'audit.read_platform',
              ]),
            )
            .min(1),
          reason: z.string().trim().min(4).max(500),
          reference: z.string().trim().max(160).optional(),
          startsAt: z.coerce.date(),
          expiresAt: z.coerce.date(),
        })
        .parse(req.body);
      const result = await access.grantAccess({
        granteeId: input.granteeId,
        clientId: input.clientId,
        scope: input.scope,
        capabilities: input.capabilities,
        reason: input.reason,
        startsAt: input.startsAt,
        expiresAt: input.expiresAt,
        ...(input.reference ? { reference: input.reference } : {}),
        actorId: req.auth!.userId,
        idempotencyKey: idempotencyKey(req.get('Idempotency-Key')),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/access-grants/:grantId/revoke', canChange, async (req, res, next) => {
    try {
      const result = await access.revokeGrant({
        grantId: req.params.grantId as string,
        actorId: req.auth!.userId,
        idempotencyKey: idempotencyKey(req.get('Idempotency-Key')),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/assignments', canChange, async (req, res, next) => {
    try {
      const input = z.object({ staffUserId: z.uuid(), clientId: z.uuid() }).parse(req.body);
      const staff = await prisma.user.findUnique({
        where: { id: input.staffUserId },
        select: { role: true },
      });
      if (!staff || staff.role !== 'CONSULTANT')
        throw new AppError(
          'INVALID_ASSIGNEE',
          400,
          'Only a Consultant may receive a client assignment',
        );
      const result = await access.assignStaff({
        ...input,
        actorId: req.auth!.userId,
        idempotencyKey: idempotencyKey(req.get('Idempotency-Key')),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/assignments/:assignmentId/deactivate', canChange, async (req, res, next) => {
    try {
      const result = await access.deactivateAssignment({
        assignmentId: req.params.assignmentId as string,
        actorId: req.auth!.userId,
        idempotencyKey: idempotencyKey(req.get('Idempotency-Key')),
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
