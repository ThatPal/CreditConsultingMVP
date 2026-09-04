import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmailProvider } from './emailProvider.js';

export type CreateNotificationInput = {
  semanticKey: string;
  userId: string;
  clientId: string;
  type: string;
  category: string;
  title: string;
  body: string;
  link?: string;
  safePayload?: Record<string, string | number | boolean | null>;
  email?: boolean;
  emailProvider?: EmailProvider['name'];
};

export function validateInternalNotificationLink(link?: string) {
  if (link === undefined) return undefined;
  if (!/^\/app(?:\/|$)/.test(link) || link.startsWith('//') || link.includes('\\'))
    throw new Error('INVALID_NOTIFICATION_LINK');
  return link;
}

export const mandatoryInAppCategories = new Set(['OPERATIONAL', 'SECURITY', 'SUPPORT_MANDATORY']);

export async function notificationChannelEnabled(
  prisma: PrismaClient,
  input: { userId: string; category: string; channel: 'IN_APP' | 'EMAIL' },
) {
  if (input.channel === 'IN_APP' && mandatoryInAppCategories.has(input.category)) return true;
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_category_channel: input },
    select: { enabled: true },
  });
  return preference?.enabled ?? true;
}

function assertRecipientSafe(input: CreateNotificationInput) {
  if (!input.semanticKey.trim() || input.semanticKey.length > 160)
    throw new Error('INVALID_NOTIFICATION_SEMANTIC_KEY');
  if (!input.title.trim() || input.title.length > 160 || input.body.length > 2000)
    throw new Error('INVALID_NOTIFICATION_CONTENT');
  validateInternalNotificationLink(input.link);
}

export async function createCanonicalNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput,
) {
  assertRecipientSafe(input);
  const existing = await prisma.notification.findUnique({
    where: { userId_semanticKey: { userId: input.userId, semanticKey: input.semanticKey } },
  });
  if (existing) return { notification: existing, created: false };
  const emailEnabled = input.email
    ? await notificationChannelEnabled(prisma, {
        userId: input.userId,
        category: input.category,
        channel: 'EMAIL',
      })
    : false;

  try {
    return await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          semanticKey: input.semanticKey,
          userId: input.userId,
          clientId: input.clientId,
          type: input.type,
          category: input.category,
          title: input.title,
          body: input.body,
          ...(input.link ? { link: input.link } : {}),
          ...(input.safePayload ? { safePayload: input.safePayload } : {}),
        },
      });
      let deliveryId: string | undefined;
      if (emailEnabled) {
        const delivery = await tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            channel: 'EMAIL',
            provider: input.emailProvider ?? 'CONSOLE',
          },
        });
        deliveryId = delivery.id;
      }
      await tx.outboxEvent.create({
        data: {
          eventType: 'notification.created',
          eventKey: `notification.created:${notification.id}`,
          aggregateType: 'Notification',
          aggregateId: notification.id,
          payload: {
            clientId: input.clientId,
            domains: ['notifications'],
            ...(deliveryId ? { notificationDeliveryId: deliveryId } : {}),
          },
        },
      });
      return { notification, created: true };
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const notification = await prisma.notification.findUniqueOrThrow({
      where: { userId_semanticKey: { userId: input.userId, semanticKey: input.semanticKey } },
    });
    return { notification, created: false };
  }
}

export async function processNotificationDelivery(
  prisma: PrismaClient,
  provider: EmailProvider,
  deliveryId: string,
  now = new Date(),
) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: { include: { user: { select: { email: true } } } } },
  });
  if (!delivery) throw new Error('NOTIFICATION_DELIVERY_NOT_FOUND');
  if (delivery.status === 'DELIVERED') return delivery;
  if (delivery.status === 'FAILED') throw new Error('NOTIFICATION_DELIVERY_TERMINAL');
  if (delivery.provider !== provider.name) throw new Error('EMAIL_PROVIDER_MISMATCH');

  const claim = await prisma.notificationDelivery.updateMany({
    where: {
      id: delivery.id,
      OR: [
        { status: { in: ['PENDING', 'RETRY_SCHEDULED'] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: 'PROCESSING', lastAttemptAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) } },
      ],
    },
    data: { status: 'PROCESSING', attemptCount: { increment: 1 }, lastAttemptAt: now },
  });
  if (claim.count !== 1) return delivery;
  try {
    const result = await provider.send({
      to: delivery.notification.user.email,
      subject: delivery.notification.title,
      text: delivery.notification.body,
    });
    if (!result.accepted) throw new Error('PROVIDER_REJECTED');
    return prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: now,
        ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
        failureCategory: null,
        nextAttemptAt: null,
      },
    });
  } catch (error) {
    const attempts = delivery.attemptCount + 1;
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: attempts >= 5 ? 'FAILED' : 'RETRY_SCHEDULED',
        failureCategory: 'PROVIDER_UNAVAILABLE',
        nextAttemptAt:
          attempts >= 5
            ? null
            : new Date(now.getTime() + Math.min(15 * 60, 5 * 2 ** (attempts - 1)) * 1000),
      },
    });
    throw error;
  }
}
