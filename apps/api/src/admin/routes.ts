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
import type { DurableAIRuntime } from '../ai/durableRuntime.js';
import { assertApprovedSourceUrl } from '../cards/service.js';

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
  aiRuntime?: DurableAIRuntime,
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

  router.get('/ai/jobs', canRead, async (req, res, next) => {
    try {
      const input = z
        .object({
          status: z
            .enum([
              'QUEUED',
              'RUNNING',
              'SUCCEEDED',
              'RETRYABLE_FAILURE',
              'NON_RETRYABLE_FAILURE',
              'SCHEMA_INVALID',
              'STALE',
              'CANCELLED',
            ])
            .optional(),
          processKey: z.string().trim().max(100).optional(),
          clientId: z.uuid().optional(),
          cursor: z.uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(req.query);
      const jobs = await prisma.aIJob.findMany({
        where: {
          ...(input.status ? { status: input.status } : {}),
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.processKey ? { processDefinition: { processKey: input.processKey } } : {}),
        },
        select: {
          id: true,
          clientId: true,
          status: true,
          currentAttempt: true,
          maxAttempts: true,
          failureCategory: true,
          failureCode: true,
          relatedEntityType: true,
          relatedEntityId: true,
          createdAt: true,
          updatedAt: true,
          startedAt: true,
          completedAt: true,
          processDefinition: {
            select: { processKey: true, processVersion: true, modelProfile: true },
          },
          _count: { select: { outputs: true, artifacts: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
      });
      const hasMore = jobs.length > input.limit;
      const page = jobs.slice(0, input.limit);
      res.json({ jobs: page, hasMore, nextCursor: hasMore ? page.at(-1)?.id : null });
    } catch (error) {
      next(error);
    }
  });

  router.get('/ai/jobs/:jobId', canRead, async (req, res, next) => {
    try {
      const job = await prisma.aIJob.findUnique({
        where: { id: req.params.jobId as string },
        include: {
          processDefinition: true,
          outputs: {
            select: {
              id: true,
              status: true,
              confidence: true,
              createdAt: true,
              staleAt: true,
              provenance: true,
            },
          },
          artifacts: {
            select: {
              id: true,
              artifactType: true,
              artifactVersion: true,
              current: true,
              staleAt: true,
              createdAt: true,
            },
          },
        },
      });
      if (!job) throw new AppError('NOT_FOUND', 404, 'AI job was not found');
      res.json({
        job: {
          ...job,
          inputEnvelope: '[REDACTED]',
          sourceVersions: redactMetadata(job.sourceVersions),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/ai/jobs/:jobId/retry', canChange, async (req, res, next) => {
    try {
      const jobId = req.params.jobId as string;
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; status: string }>(prisma, {
        idempotency: { scope: 'admin-ai', subjectId: jobId, operation: 'retry', key },
        audit: {
          actorId: req.auth!.userId,
          action: 'ADMIN_AI_JOB_RETRIED',
          entityType: 'AIJob',
          entityId: jobId,
        },
        outbox: {
          eventType: 'ai.job-retry-requested',
          eventKey: key,
          aggregateType: 'AIJob',
          aggregateId: jobId,
          payload: { jobId, domains: ['ai-runtime'] },
        },
        mutate: async (tx) => {
          const changed = await tx.aIJob.updateMany({
            where: {
              id: jobId,
              status: {
                in: ['RETRYABLE_FAILURE', 'NON_RETRYABLE_FAILURE', 'SCHEMA_INVALID', 'STALE'],
              },
            },
            data: {
              status: 'QUEUED',
              availableAt: new Date(),
              completedAt: null,
              failureCode: null,
              failureCategory: null,
            },
          });
          if (changed.count !== 1)
            throw new AppError(
              'AI_JOB_NOT_RETRYABLE',
              409,
              'AI job is not in a retryable terminal state',
            );
          return { id: jobId, status: 'QUEUED' };
        },
      });
      await aiRuntime?.reconstructAndEnqueue();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/ai/jobs/:jobId/cancel', canChange, async (req, res, next) => {
    try {
      const jobId = req.params.jobId as string;
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; status: string }>(prisma, {
        idempotency: { scope: 'admin-ai', subjectId: jobId, operation: 'cancel', key },
        audit: {
          actorId: req.auth!.userId,
          action: 'ADMIN_AI_JOB_CANCELLED',
          entityType: 'AIJob',
          entityId: jobId,
        },
        outbox: {
          eventType: 'ai.job-cancelled',
          eventKey: key,
          aggregateType: 'AIJob',
          aggregateId: jobId,
          payload: { jobId, domains: ['ai-runtime'] },
        },
        mutate: async (tx) => {
          const changed = await tx.aIJob.updateMany({
            where: { id: jobId, status: { in: ['QUEUED', 'RETRYABLE_FAILURE'] } },
            data: { status: 'CANCELLED', completedAt: new Date() },
          });
          if (changed.count !== 1)
            throw new AppError(
              'AI_JOB_NOT_CANCELLABLE',
              409,
              'Only queued or retryable jobs may be cancelled',
            );
          return { id: jobId, status: 'CANCELLED' };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/ai/processes', canRead, async (_req, res, next) => {
    try {
      const definitions = await prisma.aIProcessDefinition.findMany({
        select: {
          id: true,
          processKey: true,
          processVersion: true,
          enabled: true,
          modelProfile: true,
          inputSchemaVersion: true,
          outputSchemaVersion: true,
          instructionVersion: true,
          retryPolicy: true,
          dataClassification: true,
          allowedContext: true,
          domainConsumer: true,
          createdAt: true,
          retiredAt: true,
          _count: { select: { jobs: true } },
        },
        orderBy: [{ processKey: 'asc' }, { processVersion: 'desc' }, { id: 'asc' }],
      });
      res.json({ definitions });
    } catch (error) {
      next(error);
    }
  });
  router.post('/ai/processes/:processKey/versions', canChange, async (req, res, next) => {
    try {
      const processKey = z.string().trim().min(3).max(120).parse(req.params.processKey);
      const input = z
        .object({
          modelProfile: z
            .string()
            .trim()
            .regex(/^[a-zA-Z0-9._-]{2,80}$/),
          inputSchemaVersion: z.number().int().positive(),
          outputSchemaVersion: z.number().int().positive(),
          instructionVersion: z
            .string()
            .trim()
            .regex(/^[a-zA-Z0-9._-]{2,80}$/),
          maxAttempts: z.number().int().min(1).max(10),
          dataClassification: z.enum(['PUBLIC', 'INTERNAL', 'SENSITIVE']),
          allowedContext: z.array(z.string().trim().min(1).max(100)).max(50),
          domainConsumer: z.string().trim().min(2).max(80),
          enabled: z.boolean().default(false),
          reason: z.string().trim().min(8).max(500),
        })
        .parse(req.body);
      if (
        sensitiveMetadataKey.test(input.modelProfile) ||
        input.allowedContext.some((v) => sensitiveMetadataKey.test(v))
      )
        throw new AppError(
          'SECRET_REFERENCE_REJECTED',
          400,
          'Configuration may reference profiles and fields, never secrets',
        );
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; processVersion: number }>(
        prisma,
        {
          idempotency: {
            scope: 'admin-ai-config',
            subjectId: processKey,
            operation: 'create-version',
            key,
          },
          audit: (r) => ({
            actorId: req.auth!.userId,
            action: 'ADMIN_AI_PROCESS_VERSION_CREATED',
            entityType: 'AIProcessDefinition',
            entityId: r.id,
            metadata: { processKey, processVersion: r.processVersion, reason: input.reason },
          }),
          outbox: {
            eventType: 'ai.process-version-created',
            eventKey: key,
            aggregateType: 'AIProcessDefinition',
            payload: (r) => ({
              id: r.id,
              processKey,
              processVersion: r.processVersion,
              domains: ['ai-runtime', 'configuration'],
            }),
          },
          mutate: async (tx) => {
            const latest = await tx.aIProcessDefinition.findFirst({
              where: { processKey },
              orderBy: { processVersion: 'desc' },
            });
            if (
              latest &&
              (latest.inputSchemaVersion !== input.inputSchemaVersion ||
                latest.outputSchemaVersion !== input.outputSchemaVersion) &&
              input.enabled
            )
              throw new AppError(
                'AI_SCHEMA_ACTIVATION_REQUIRES_MIGRATION',
                409,
                'A schema-changing version must be created disabled and reviewed before activation',
              );
            const created = await tx.aIProcessDefinition.create({
              data: {
                processKey,
                processVersion: (latest?.processVersion ?? 0) + 1,
                authorityLevel: 'FACTUAL_LEVEL_1',
                enabled: input.enabled,
                modelProfile: input.modelProfile,
                inputSchemaVersion: input.inputSchemaVersion,
                outputSchemaVersion: input.outputSchemaVersion,
                instructionVersion: input.instructionVersion,
                retryPolicy: { maxAttempts: input.maxAttempts },
                dataClassification: input.dataClassification,
                allowedContext: input.allowedContext,
                domainConsumer: input.domainConsumer,
              },
            });
            if (input.enabled && latest)
              await tx.aIProcessDefinition.updateMany({
                where: { processKey, id: { not: created.id }, enabled: true },
                data: { enabled: false, retiredAt: new Date() },
              });
            return { id: created.id, processVersion: created.processVersion };
          },
        },
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/sources', canRead, async (_req, res, next) => {
    try {
      const sources = await prisma.cardSource.findMany({
        select: {
          id: true,
          key: true,
          name: true,
          baseUrl: true,
          allowedHosts: true,
          official: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { mappings: true, candidates: true } },
        },
        orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      });
      res.json({ sources });
    } catch (error) {
      next(error);
    }
  });
  router.post('/sources', canChange, async (req, res, next) => {
    try {
      const input = z
        .object({
          key: z
            .string()
            .trim()
            .regex(/^[a-z0-9._-]{2,80}$/),
          name: z.string().trim().min(2).max(120),
          baseUrl: z.url(),
          allowedHosts: z
            .array(
              z
                .string()
                .trim()
                .toLowerCase()
                .regex(/^[a-z0-9.-]+$/),
            )
            .min(1)
            .max(20),
          official: z.boolean().default(false),
          reason: z.string().trim().min(8).max(500),
        })
        .parse(req.body);
      const normalized = assertApprovedSourceUrl(input.baseUrl, input.allowedHosts);
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string }>(prisma, {
        idempotency: { scope: 'admin-source', subjectId: input.key, operation: 'create', key },
        audit: (r) => ({
          actorId: req.auth!.userId,
          action: 'ADMIN_SOURCE_CREATED',
          entityType: 'CardSource',
          entityId: r.id,
          metadata: { key: input.key, reason: input.reason },
        }),
        outbox: {
          eventType: 'source.registry-changed',
          eventKey: key,
          aggregateType: 'CardSource',
          payload: (r) => ({ id: r.id, domains: ['catalog', 'retrieval'] }),
        },
        mutate: async (tx) =>
          tx.cardSource.create({
            data: {
              key: input.key,
              name: input.name,
              baseUrl: normalized,
              allowedHosts: input.allowedHosts,
              official: input.official,
              active: false,
            },
            select: { id: true },
          }),
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });
  router.patch('/sources/:sourceId', canChange, async (req, res, next) => {
    try {
      const sourceId = req.params.sourceId as string;
      const input = z
        .object({
          active: z.boolean(),
          expectedUpdatedAt: z.coerce.date(),
          reason: z.string().trim().min(8).max(500),
        })
        .parse(req.body);
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; active: boolean }>(prisma, {
        idempotency: { scope: 'admin-source', subjectId: sourceId, operation: 'set-active', key },
        audit: (r) => ({
          actorId: req.auth!.userId,
          action: r.active ? 'ADMIN_SOURCE_ACTIVATED' : 'ADMIN_SOURCE_DEACTIVATED',
          entityType: 'CardSource',
          entityId: r.id,
          metadata: { reason: input.reason },
        }),
        outbox: {
          eventType: 'source.registry-changed',
          eventKey: key,
          aggregateType: 'CardSource',
          aggregateId: sourceId,
          payload: { sourceId, domains: ['catalog', 'retrieval'] },
        },
        mutate: async (tx) => {
          const changed = await tx.cardSource.updateMany({
            where: { id: sourceId, updatedAt: input.expectedUpdatedAt },
            data: { active: input.active },
          });
          if (changed.count !== 1)
            throw new AppError('STALE_SOURCE', 409, 'Source changed; refresh before continuing');
          return { id: sourceId, active: input.active };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/workflow-rules', canRead, async (_req, res, next) => {
    try {
      res.json({
        rules: await prisma.workflowRule.findMany({
          orderBy: [{ key: 'asc' }, { version: 'desc' }, { id: 'asc' }],
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/workflow-rules/:ruleKey/versions', canChange, async (req, res, next) => {
    try {
      const ruleKey = z
        .string()
        .trim()
        .regex(/^[a-z0-9._-]{3,100}$/)
        .parse(req.params.ruleKey);
      const input = z
        .object({
          trigger: z.enum([
            'SUPPORT_CASE_CREATED',
            'DOCUMENT_UPLOADED',
            'PAYMENT_FAILED',
            'AI_JOB_FAILED',
            'ROUND_COMPLETED',
          ]),
          condition: z.discriminatedUnion('type', [
            z.object({ type: z.literal('ALWAYS') }),
            z.object({
              type: z.literal('STATUS_EQUALS'),
              status: z.string().trim().min(1).max(50),
            }),
            z.object({
              type: z.literal('AGE_EXCEEDS_MINUTES'),
              minutes: z.number().int().min(5).max(43200),
            }),
          ]),
          action: z.discriminatedUnion('type', [
            z.object({
              type: z.literal('CREATE_NOTIFICATION'),
              category: z.string().trim().min(2).max(80),
            }),
            z.object({
              type: z.literal('CREATE_ATTENTION_ITEM'),
              priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
            }),
            z.object({
              type: z.literal('SEND_TEMPLATE'),
              templateKey: z
                .string()
                .trim()
                .regex(/^[a-z0-9._-]{2,100}$/),
            }),
          ]),
          enabled: z.boolean().default(false),
          reason: z.string().trim().min(8).max(500),
        })
        .parse(req.body);
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; version: number }>(prisma, {
        idempotency: {
          scope: 'admin-workflow',
          subjectId: ruleKey,
          operation: 'create-version',
          key,
        },
        audit: (r) => ({
          actorId: req.auth!.userId,
          action: 'ADMIN_WORKFLOW_RULE_VERSION_CREATED',
          entityType: 'WorkflowRule',
          entityId: r.id,
          metadata: { key: ruleKey, version: r.version, reason: input.reason },
        }),
        outbox: {
          eventType: 'workflow.rule-version-created',
          eventKey: key,
          aggregateType: 'WorkflowRule',
          payload: (r) => ({
            id: r.id,
            key: ruleKey,
            version: r.version,
            domains: ['workflow', 'configuration'],
          }),
        },
        mutate: async (tx) => {
          const latest = await tx.workflowRule.findFirst({
            where: { key: ruleKey },
            orderBy: { version: 'desc' },
          });
          const created = await tx.workflowRule.create({
            data: {
              key: ruleKey,
              version: (latest?.version ?? 0) + 1,
              trigger: input.trigger,
              conditionType: input.condition.type,
              conditionConfig: input.condition,
              actionType: input.action.type,
              actionConfig: input.action,
              enabled: input.enabled,
              reason: input.reason,
              createdById: req.auth!.userId,
            },
          });
          if (input.enabled && latest)
            await tx.workflowRule.updateMany({
              where: { key: ruleKey, id: { not: created.id }, enabled: true },
              data: { enabled: false, retiredAt: new Date() },
            });
          return { id: created.id, version: created.version };
        },
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/notification-templates', canRead, async (_req, res, next) => {
    try {
      res.json({
        templates: await prisma.notificationTemplate.findMany({
          orderBy: [{ key: 'asc' }, { channel: 'asc' }, { version: 'desc' }],
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/notification-templates/:templateKey/versions',
    canChange,
    async (req, res, next) => {
      try {
        const templateKey = z
          .string()
          .trim()
          .regex(/^[a-z0-9._-]{2,100}$/)
          .parse(req.params.templateKey);
        const input = z
          .object({
            channel: z.enum(['IN_APP', 'EMAIL']),
            subject: z.string().trim().min(2).max(160).optional(),
            body: z.string().trim().min(2).max(10000),
            enabled: z.boolean().default(false),
            reason: z.string().trim().min(8).max(500),
          })
          .parse(req.body);
        if (input.channel === 'EMAIL' && !input.subject)
          throw new AppError('TEMPLATE_SUBJECT_REQUIRED', 400, 'Email templates require a subject');
        if (/{{\s*(password|token|secret|card)/i.test(`${input.subject ?? ''} ${input.body}`))
          throw new AppError(
            'UNSAFE_TEMPLATE_VARIABLE',
            400,
            'Sensitive template variables are prohibited',
          );
        const key = idempotencyKey(req.get('Idempotency-Key'));
        const result = await executeConsequentialCommand<{ id: string; version: number }>(prisma, {
          idempotency: {
            scope: 'admin-template',
            subjectId: `${templateKey}:${input.channel}`,
            operation: 'create-version',
            key,
          },
          audit: (r) => ({
            actorId: req.auth!.userId,
            action: 'ADMIN_NOTIFICATION_TEMPLATE_VERSION_CREATED',
            entityType: 'NotificationTemplate',
            entityId: r.id,
            metadata: {
              templateKey,
              channel: input.channel,
              version: r.version,
              reason: input.reason,
            },
          }),
          outbox: {
            eventType: 'notification.template-version-created',
            eventKey: key,
            aggregateType: 'NotificationTemplate',
            payload: (r) => ({
              id: r.id,
              templateKey,
              version: r.version,
              domains: ['notifications', 'configuration'],
            }),
          },
          mutate: async (tx) => {
            const latest = await tx.notificationTemplate.findFirst({
              where: { key: templateKey, channel: input.channel },
              orderBy: { version: 'desc' },
            });
            const created = await tx.notificationTemplate.create({
              data: {
                key: templateKey,
                version: (latest?.version ?? 0) + 1,
                channel: input.channel,
                subject: input.subject ?? null,
                body: input.body,
                enabled: input.enabled,
                safeMetadata: { reason: input.reason },
              },
            });
            if (input.enabled)
              await tx.notificationTemplate.updateMany({
                where: {
                  key: templateKey,
                  channel: input.channel,
                  id: { not: created.id },
                  enabled: true,
                },
                data: { enabled: false },
              });
            return { id: created.id, version: created.version };
          },
        });
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/notification-deliveries', canRead, async (req, res, next) => {
    try {
      const input = z
        .object({
          status: z
            .enum(['PENDING', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'FAILED'])
            .optional(),
          cursor: z.uuid().optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        })
        .parse(req.query);
      const rows = await prisma.notificationDelivery.findMany({
        where: input.status ? { status: input.status } : {},
        select: {
          id: true,
          channel: true,
          provider: true,
          status: true,
          attemptCount: true,
          nextAttemptAt: true,
          lastAttemptAt: true,
          deliveredAt: true,
          failureCategory: true,
          createdAt: true,
          notification: { select: { category: true, userId: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
      });
      res.json({
        deliveries: rows.slice(0, input.limit),
        nextCursor: rows.length > input.limit ? rows[input.limit - 1]?.id : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/integrations', canRead, async (_req, res, next) => {
    try {
      const integrations = await prisma.integration.findMany({
        select: {
          id: true,
          key: true,
          type: true,
          provider: true,
          enabled: true,
          status: true,
          configurationMetadata: true,
          secretReferences: true,
          lastTestedAt: true,
          lastSuccessAt: true,
          lastErrorCategory: true,
          updatedAt: true,
        },
        orderBy: [{ type: 'asc' }, { key: 'asc' }, { id: 'asc' }],
      });
      res.json({
        integrations: integrations.map(({ secretReferences, ...item }) => ({
          ...item,
          configurationMetadata: redactMetadata(item.configurationMetadata),
          secretConfiguration: {
            configured: secretReferences.length > 0,
            count: secretReferences.length,
          },
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/integrations/:integrationId/enabled', canChange, async (req, res, next) => {
    try {
      const integrationId = req.params.integrationId as string;
      const input = z
        .object({
          enabled: z.boolean(),
          expectedUpdatedAt: z.coerce.date(),
          reason: z.string().trim().min(8).max(500),
        })
        .parse(req.body);
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; enabled: boolean }>(prisma, {
        idempotency: {
          scope: 'admin-integration',
          subjectId: integrationId,
          operation: 'set-enabled',
          key,
        },
        audit: (r) => ({
          actorId: req.auth!.userId,
          action: r.enabled ? 'ADMIN_INTEGRATION_ENABLED' : 'ADMIN_INTEGRATION_DISABLED',
          entityType: 'Integration',
          entityId: r.id,
          metadata: { reason: input.reason },
        }),
        outbox: {
          eventType: 'integration.configuration-changed',
          eventKey: key,
          aggregateType: 'Integration',
          aggregateId: integrationId,
          payload: { integrationId, domains: ['integrations', 'configuration'] },
        },
        mutate: async (tx) => {
          const changed = await tx.integration.updateMany({
            where: { id: integrationId, updatedAt: input.expectedUpdatedAt },
            data: { enabled: input.enabled, status: input.enabled ? 'UNTESTED' : 'DISABLED' },
          });
          if (changed.count !== 1)
            throw new AppError(
              'STALE_INTEGRATION',
              409,
              'Integration changed; refresh before continuing',
            );
          return { id: integrationId, enabled: input.enabled };
        },
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/scheduled-jobs', canRead, async (_req, res, next) => {
    try {
      res.json({
        definitions: await prisma.scheduledJobDefinition.findMany({
          include: { runs: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10 } },
          orderBy: [{ key: 'asc' }, { id: 'asc' }],
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/scheduled-jobs/:definitionId/run', canChange, async (req, res, next) => {
    try {
      const definitionId = req.params.definitionId as string;
      const key = idempotencyKey(req.get('Idempotency-Key'));
      const result = await executeConsequentialCommand<{ id: string; status: string }>(prisma, {
        idempotency: {
          scope: 'admin-scheduled-job',
          subjectId: definitionId,
          operation: 'manual-run',
          key,
        },
        audit: (r) => ({
          actorId: req.auth!.userId,
          action: 'ADMIN_SCHEDULED_JOB_ENQUEUED',
          entityType: 'ScheduledJobRun',
          entityId: r.id,
        }),
        outbox: {
          eventType: 'scheduled-job.run-requested',
          eventKey: key,
          aggregateType: 'ScheduledJobDefinition',
          aggregateId: definitionId,
          payload: (r) => ({ runId: r.id, definitionId, domains: ['scheduled-jobs'] }),
        },
        mutate: async (tx) => {
          const definition = await tx.scheduledJobDefinition.findUnique({
            where: { id: definitionId },
          });
          if (!definition?.enabled)
            throw new AppError('SCHEDULED_JOB_DISABLED', 409, 'Disabled jobs cannot be run');
          const active = await tx.scheduledJobRun.count({
            where: { definitionId, status: 'RUNNING', leaseUntil: { gt: new Date() } },
          });
          if (active)
            throw new AppError(
              'SCHEDULED_JOB_ALREADY_RUNNING',
              409,
              'A leased run is already active',
            );
          return tx.scheduledJobRun.create({
            data: { definitionId, status: 'QUEUED' },
            select: { id: true, status: true },
          });
        },
      });
      res.status(result.replayed ? 200 : 202).json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
