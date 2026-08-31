import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';

export async function recordAuthAudit(
  prisma: PrismaClient,
  action: string,
  options: {
    actorId?: string | null;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, string | boolean | number>;
  } = {},
) {
  const client = options.actorId
    ? await prisma.client.findUnique({
        where: { userId: options.actorId },
        select: { id: true },
      })
    : null;
  await prisma.auditEvent.create({
    data: {
      ...(options.actorId ? { actorId: options.actorId } : {}),
      ...(client ? { clientId: client.id } : {}),
      action,
      entityType: options.entityType ?? 'Authentication',
      ...(options.entityId ? { entityId: options.entityId } : {}),
      source: 'BETTER_AUTH',
      metadata: options.metadata ?? {},
    },
  });
}

export function createAuthFailureAuditMiddleware(prisma: PrismaClient): RequestHandler {
  return (request, response, next) => {
    response.once('finish', () => {
      if (request.path.endsWith('/sign-in/email') && response.statusCode >= 400) {
        const category =
          response.statusCode === 429
            ? 'RATE_LIMITED'
            : response.statusCode === 401 || response.statusCode === 403
              ? 'CREDENTIAL_OR_ACCOUNT_REJECTED'
              : 'REQUEST_REJECTED';
        void recordAuthAudit(prisma, 'AUTH_LOGIN_FAILED', {
          metadata: { category, statusCode: response.statusCode },
        }).catch(() => undefined);
      }
      if (request.path.endsWith('/two-factor/verify-totp') && response.statusCode >= 400) {
        const category = response.statusCode === 429 ? 'RATE_LIMITED' : 'CHALLENGE_REJECTED';
        void prisma.securityEvent
          .create({
            data: {
              eventType: 'AUTH_MFA_CHALLENGE_FAILED',
              severity: response.statusCode === 429 ? 'HIGH' : 'WARNING',
              category: 'MFA_CHALLENGE',
              metadata: { category, statusCode: response.statusCode },
            },
          })
          .catch(() => undefined);
      }
    });
    next();
  };
}
