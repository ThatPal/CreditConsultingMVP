import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import type { EmailProvider } from './emailProvider.js';
import {
  createCanonicalNotification,
  notificationChannelEnabled,
  processNotificationDelivery,
  validateInternalNotificationLink,
} from './notificationService.js';

describe('canonical notification lifecycle', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const suite = `sprint33-${randomUUID()}`;
  let prisma: PrismaClient;
  let userId: string;
  let clientId: string;

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    const user = await prisma.user.create({
      data: {
        email: `${suite}@example.test`,
        role: 'CLIENT',
        client: {
          create: { firstName: 'Sprint', lastName: 'ThirtyThree', termsAcceptedAt: new Date() },
        },
      },
      include: { client: true },
    });
    userId = user.id;
    clientId = user.client!.id;
  });

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({
      where: {
        eventKey: { startsWith: 'notification.created:' },
        aggregateId: {
          in: (await prisma.notification.findMany({ where: { userId }, select: { id: true } })).map(
            ({ id }) => id,
          ),
        },
      },
    });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('persists one canonical notification and one durable delivery per semantic key', async () => {
    const input = {
      semanticKey: `${suite}:account-update`,
      userId,
      clientId,
      type: 'ACCOUNT_UPDATED',
      category: 'OPERATIONAL',
      title: 'Account update available',
      body: 'Sign in to review the latest account update.',
      link: '/app/account',
      email: true,
      emailProvider: 'CONSOLE' as const,
    };
    const first = await createCanonicalNotification(prisma, input);
    const duplicate = await createCanonicalNotification(prisma, input);
    expect(first.created).toBe(true);
    expect(duplicate).toMatchObject({
      created: false,
      notification: { id: first.notification.id },
    });
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(1);
    await expect(
      prisma.notificationDelivery.count({ where: { notificationId: first.notification.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { aggregateId: first.notification.id } }),
    ).resolves.toBe(1);
  });

  test('email failure and retry never roll back or duplicate the notification', async () => {
    const notification = await prisma.notification.findFirstOrThrow({ where: { userId } });
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({
      where: { notificationId: notification.id },
    });
    const failing: EmailProvider = {
      name: 'CONSOLE',
      send: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    await expect(processNotificationDelivery(prisma, failing, delivery.id)).rejects.toThrow(
      'offline',
    );
    await expect(
      prisma.notification.findUnique({ where: { id: notification.id } }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.notificationDelivery.findUnique({ where: { id: delivery.id } }),
    ).resolves.toMatchObject({
      status: 'RETRY_SCHEDULED',
      attemptCount: 1,
      failureCategory: 'PROVIDER_UNAVAILABLE',
    });

    const succeeding: EmailProvider = {
      name: 'CONSOLE',
      send: vi.fn(async () => ({ accepted: true, providerMessageId: 'safe-message-id' })),
    };
    await processNotificationDelivery(prisma, succeeding, delivery.id, new Date(Date.now() + 60_000));
    await processNotificationDelivery(prisma, succeeding, delivery.id);
    expect(succeeding.send).toHaveBeenCalledTimes(1);
    await expect(prisma.notification.count({ where: { userId } })).resolves.toBe(1);
    await expect(
      prisma.notificationDelivery.findUnique({ where: { id: delivery.id } }),
    ).resolves.toMatchObject({
      status: 'DELIVERED',
      attemptCount: 2,
      providerMessageId: 'safe-message-id',
    });
  });

  test('accepts only internal client deep links', () => {
    expect(validateInternalNotificationLink('/app/documents')).toBe('/app/documents');
    expect(() => validateInternalNotificationLink('https://evil.example')).toThrow(
      'INVALID_NOTIFICATION_LINK',
    );
    expect(() => validateInternalNotificationLink('//evil.example')).toThrow(
      'INVALID_NOTIFICATION_LINK',
    );
  });

  test('honors optional email preference while mandatory in-app delivery stays enabled', async () => {
    await prisma.notificationPreference.upsert({
      where: { userId_category_channel: { userId, category: 'SUPPORT', channel: 'EMAIL' } },
      create: { userId, category: 'SUPPORT', channel: 'EMAIL', enabled: false },
      update: { enabled: false },
    });
    await expect(notificationChannelEnabled(prisma, { userId, category: 'SUPPORT', channel: 'EMAIL' })).resolves.toBe(false);
    await expect(notificationChannelEnabled(prisma, { userId, category: 'SECURITY', channel: 'IN_APP' })).resolves.toBe(true);
  });
});
