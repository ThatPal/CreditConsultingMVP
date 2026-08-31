import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { verifyPassword, hashPassword } from './security.js';
import type { AppEnv } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmailProvider } from '../notifications/emailProvider.js';
import { createAuthEmailNotifier } from '../notifications/emailProvider.js';
import { recordAuthAudit } from './authAudit.js';

export function createBetterAuth(prisma: PrismaClient, env: AppEnv, provider: EmailProvider) {
  const email = createAuthEmailNotifier(provider);
  const isTrustedReturnTarget = (value: unknown) => {
    if (typeof value !== 'string') return true;
    if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
    try {
      return new URL(value).origin === new URL(env.WEB_ORIGIN).origin;
    } catch {
      return false;
    }
  };
  return betterAuth({
    appName: 'Credit Strategy Platform',
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT_ENABLED,
      window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      max: env.AUTH_RATE_LIMIT_MAX,
      customRules: Object.fromEntries(
        [
          '/sign-in/email',
          '/sign-up/email',
          '/request-password-reset',
          '/send-verification-email',
          '/reset-password',
        ].map((path) => [
          path,
          { window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS, max: env.AUTH_RATE_LIMIT_MAX },
        ]),
      ),
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: env.NODE_ENV === 'production',
    },
    user: {
      modelName: 'User',
      additionalFields: {
        role: { type: 'string', required: true, input: false, defaultValue: 'CLIENT' },
        status: { type: 'string', required: true, input: false, defaultValue: 'ACTIVE' },
        authProvider: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: 'better-auth',
        },
        authFirstName: { type: 'string', required: false, input: true, returned: false },
        authLastName: { type: 'string', required: false, input: true, returned: false },
        authPhone: { type: 'string', required: false, input: true, returned: false },
        authTimezone: { type: 'string', required: false, input: true, returned: false },
        authTermsAccepted: { type: 'boolean', required: false, input: true, returned: false },
      },
    },
    session: { modelName: 'BetterAuthSession', expiresIn: env.SESSION_TTL_HOURS * 3600 },
    account: { modelName: 'BetterAuthAccount' },
    verification: { modelName: 'BetterAuthVerification' },
    hooks: {
      before: createAuthMiddleware(async (context) => {
        const body = context.body as Record<string, unknown> | undefined;
        if (!isTrustedReturnTarget(body?.callbackURL) || !isTrustedReturnTarget(body?.redirectTo)) {
          await recordAuthAudit(prisma, 'AUTH_RETURN_PATH_BLOCKED', {
            metadata: { endpoint: context.path, category: 'UNTRUSTED_RETURN_TARGET' },
          });
          throw APIError.fromStatus('FORBIDDEN', {
            message: 'Return URL must stay within the client application',
          });
        }
        if (context.path === '/sign-up/email' && body?.authTermsAccepted !== true)
          throw APIError.fromStatus('BAD_REQUEST', { message: 'Terms acceptance is required' });
      }),
      after: createAuthMiddleware(async (context) => {
        if (context.path === '/reset-password' && !isAPIError(context.context.returned))
          await recordAuthAudit(prisma, 'AUTH_PASSWORD_RESET_COMPLETED', {
            metadata: { sessionPolicy: 'REVOKE_ALL' },
          });
      }),
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => verifyPassword(hash, password),
      },
      sendResetPassword: async ({ user, url }) => email.passwordReset({ email: user.email, url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        email.verification({ email: user.email, url }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              name: user.name.trim(),
            },
          }),
          after: async (user) => {
            const values = user as typeof user & {
              authFirstName?: string;
              authLastName?: string;
              authPhone?: string;
              authTimezone?: string;
              authTermsAccepted?: boolean;
            };
            const client = await prisma.client.upsert({
              where: { userId: user.id },
              update: {},
              create: {
                userId: user.id,
                firstName: values.authFirstName?.trim() || user.name.split(' ')[0] || 'Client',
                lastName:
                  values.authLastName?.trim() ||
                  user.name.split(' ').slice(1).join(' ') ||
                  'Account',
                ...(values.authPhone?.trim() ? { phone: values.authPhone.trim() } : {}),
                timezone: values.authTimezone || 'America/New_York',
                termsAcceptedAt: new Date(),
              },
            });
            await prisma.auditEvent.create({
              data: {
                actorId: user.id,
                clientId: client.id,
                action: 'AUTH_CLIENT_REGISTERED',
                entityType: 'User',
                entityId: user.id,
                source: 'BETTER_AUTH',
                metadata: { provider: 'credential' },
              },
            });
          },
        },
        update: {
          after: async (user, context) => {
            if (context?.path === '/verify-email' && user.emailVerified)
              await recordAuthAudit(prisma, 'AUTH_EMAIL_VERIFIED', {
                actorId: user.id,
                entityType: 'User',
                entityId: user.id,
              });
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            await recordAuthAudit(prisma, 'AUTH_SESSION_CREATED', {
              actorId: session.userId,
              entityType: 'BetterAuthSession',
              entityId: session.id,
              metadata: { authenticationMethod: 'password' },
            });
            if (context?.path === '/sign-in/email')
              await recordAuthAudit(prisma, 'AUTH_LOGIN_SUCCEEDED', {
                actorId: session.userId,
                entityType: 'BetterAuthSession',
                entityId: session.id,
                metadata: { authenticationMethod: 'password' },
              });
          },
        },
        delete: {
          after: async (session, context) => {
            const path = context?.path;
            if (path === '/sign-out')
              await recordAuthAudit(prisma, 'AUTH_LOGOUT', {
                actorId: session.userId,
                entityType: 'BetterAuthSession',
                entityId: session.id,
              });
            if (
              path &&
              ['/revoke-session', '/revoke-other-sessions', '/revoke-sessions'].includes(path)
            )
              await recordAuthAudit(prisma, 'AUTH_SESSION_REVOKED', {
                actorId: session.userId,
                entityType: 'BetterAuthSession',
                entityId: session.id,
                metadata: { endpoint: path },
              });
          },
        },
      },
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

export async function resolveBetterAuthPrincipal(
  auth: BetterAuthInstance,
  prisma: PrismaClient,
  headers: IncomingHttpHeaders,
) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, status: true, client: { select: { id: true } } },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    clientId: user.client?.id ?? null,
  };
}
