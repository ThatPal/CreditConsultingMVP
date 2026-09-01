import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import type { EmailProvider } from './emailProvider.js';

const preferenceSchema = z.object({
  category: z.string().trim().min(1).max(80),
  channel: z.enum(['IN_APP', 'EMAIL']),
  enabled: z.boolean(),
});

const notificationCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export function encodeNotificationCursor(value: { createdAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }))
    .toString('base64url');
}

export function decodeNotificationCursor(value: string) {
  try {
    return notificationCursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString()));
  } catch {
    throw new AppError('INVALID_CURSOR', 400, 'Notification continuation is invalid');
  }
}

const publicIntegrationMetadataKeys = new Set([
  'host',
  'port',
  'secure',
  'from',
  'supportedProviders',
  'smtpDeploymentOptions',
]);
export function safeIntegrationMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => publicIntegrationMetadataKeys.has(key)),
  );
}

export function createNotificationRouter(prisma: PrismaClient) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const cursor =
        typeof req.query.cursor === 'string' ? decodeNotificationCursor(req.query.cursor) : null;
      const [notifications, unread] = await Promise.all([
        prisma.notification.findMany({
          where: {
            userId: req.auth.userId,
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: new Date(cursor.createdAt) } },
                    { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          select: {
            id: true,
            type: true,
            category: true,
            title: true,
            body: true,
            safePayload: true,
            link: true,
            seenAt: true,
            readAt: true,
            createdAt: true,
          },
        }),
        prisma.notification.count({ where: { userId: req.auth.userId, readAt: null } }),
      ]);
      const hasMore = notifications.length > limit;
      const page = notifications.slice(0, limit);
      const last = page.at(-1);
      res.json({
        notifications: page,
        unread,
        hasMore,
        nextCursor: hasMore && last ? encodeNotificationCursor(last) : null,
      });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/:notificationId/read', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.notificationId as string, userId: req.auth.userId },
      });
      if (!notification) throw new AppError('NOT_FOUND', 404, 'Notification was not found');
      const updated = notification.readAt
        ? notification
        : await prisma.notification.update({
            where: { id: notification.id },
            data: { readAt: new Date(), seenAt: notification.seenAt ?? new Date() },
          });
      res.json({
        notification: updated,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/read-all', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const now = new Date();
      await prisma.notification.updateMany({
        where: { userId: req.auth.userId, readAt: null },
        data: { readAt: now, seenAt: now },
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  router.delete('/', (_req, _res, next) =>
    next(
      new AppError('NOTIFICATION_HISTORY_IMMUTABLE', 405, 'Notification history cannot be cleared'),
    ),
  );
  router.get('/preferences/current', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const preferences = await prisma.notificationPreference.findMany({
        where: { userId: req.auth.userId },
      });
      res.json({ preferences });
    } catch (error) {
      next(error);
    }
  });
  router.put('/preferences/current', async (req, res, next) => {
    try {
      if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
      const input = preferenceSchema.parse(req.body);
      if (
        input.channel === 'IN_APP' &&
        ['OPERATIONAL', 'SECURITY'].includes(input.category) &&
        !input.enabled
      )
        throw new AppError(
          'REQUIRED_NOTIFICATION_CHANNEL',
          409,
          'Required in-app notifications cannot be disabled',
        );
      const preference = await prisma.notificationPreference.upsert({
        where: {
          userId_category_channel: {
            userId: req.auth.userId,
            category: input.category,
            channel: input.channel,
          },
        },
        create: { userId: req.auth.userId, ...input },
        update: { enabled: input.enabled },
      });
      await prisma.auditEvent.create({
        data: {
          actorId: req.auth.userId,
          clientId: req.auth.clientId,
          action: 'NOTIFICATION_PREFERENCE_UPDATED',
          entityType: 'NotificationPreference',
          entityId: preference.id,
          metadata: { category: input.category, channel: input.channel, enabled: input.enabled },
        },
      });
      res.json({ preference });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export function createIntegrationRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  emailProvider: EmailProvider,
) {
  const router = Router();
  async function requireAdmin(req: Request) {
    if (!req.auth) throw new AppError('AUTH_REQUIRED', 401, 'Authentication is required');
    if (
      !(await authorization.authorize(
        req.auth,
        'settings.manage',
        { type: 'platform' },
        { requireStepUp: true },
      ))
    )
      throw new AppError('NOT_FOUND', 404, 'Integration was not found');
  }
  router.get('/', async (req, res, next) => {
    try {
      await requireAdmin(req);
      const integrations = await prisma.integration.findMany({
        orderBy: { key: 'asc' },
        select: {
          id: true,
          key: true,
          type: true,
          provider: true,
          enabled: true,
          status: true,
          configurationMetadata: true,
          lastTestedAt: true,
          lastSuccessAt: true,
          lastErrorCategory: true,
          updatedAt: true,
        },
      });
      res.json({
        integrations: integrations.map((integration) => ({
          ...integration,
          configurationMetadata: safeIntegrationMetadata(integration.configurationMetadata),
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/:integrationId/test-connection', async (req, res, next) => {
    try {
      await requireAdmin(req);
      const integration = await prisma.integration.findUnique({
        where: { id: req.params.integrationId as string },
      });
      if (!integration || integration.type !== 'EMAIL')
        throw new AppError('NOT_FOUND', 404, 'Integration was not found');
      const testedAt = new Date();
      let status: 'HEALTHY' | 'FAILED' = 'HEALTHY';
      let errorCategory: string | null = null;
      try {
        if (!emailProvider.testConnection) throw new Error('CONNECTION_TEST_UNAVAILABLE');
        await emailProvider.testConnection();
      } catch {
        status = 'FAILED';
        errorCategory = 'PROVIDER_UNAVAILABLE';
      }
      const updated = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status,
          lastTestedAt: testedAt,
          ...(status === 'HEALTHY' ? { lastSuccessAt: testedAt } : {}),
          lastErrorCategory: errorCategory,
        },
        select: {
          id: true,
          key: true,
          type: true,
          provider: true,
          enabled: true,
          status: true,
          lastTestedAt: true,
          lastSuccessAt: true,
          lastErrorCategory: true,
        },
      });
      await prisma.auditEvent.create({
        data: {
          actorId: req.auth!.userId,
          action: 'INTEGRATION_CONNECTION_TESTED',
          entityType: 'Integration',
          entityId: integration.id,
          metadata: { provider: integration.provider, status, errorCategory },
        },
      });
      res.status(status === 'HEALTHY' ? 200 : 503).json({ integration: updated });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
