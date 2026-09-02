import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { fromNodeHeaders } from 'better-auth/node';
import { twoFactor } from 'better-auth/plugins';
import type { IncomingHttpHeaders } from 'node:http';
import { verifyPassword, hashPassword } from './security.js';
import type { AppEnv } from '../config/env.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { EmailProvider } from '../notifications/emailProvider.js';
import { createAuthEmailNotifier } from '../notifications/emailProvider.js';
import { recordAuthAudit } from './authAudit.js';
import { bindClaimedGoalIntake, prepareGoalIntakeRegistrationClaim } from '../goals/goalIntake.js';

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
        authGoalIntakeToken: { type: 'string', required: false, input: true, returned: false },
      },
    },
    session: {
      modelName: 'BetterAuthSession',
      expiresIn: env.SESSION_TTL_HOURS * 3600,
      additionalFields: {
        staffMfaVerifiedAt: { type: 'date', required: false, input: false },
      },
    },
    account: { modelName: 'BetterAuthAccount' },
    verification: { modelName: 'BetterAuthVerification' },
    plugins: [
      twoFactor({
        issuer: 'Credit Strategy Platform',
        twoFactorTable: 'BetterAuthTwoFactor',
        backupCodeOptions: { storeBackupCodes: 'encrypted' },
        trustDeviceMaxAge: 0,
      }),
    ],
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
        if (context.path === '/sign-up/email' && typeof body?.email === 'string') {
          await prepareGoalIntakeRegistrationClaim(
            prisma,
            typeof body.authGoalIntakeToken === 'string' ? body.authGoalIntakeToken : undefined,
            body.email,
          );
          delete body.authGoalIntakeToken;
        }
      }),
      after: createAuthMiddleware(async (context) => {
        if (context.path === '/reset-password' && !isAPIError(context.context.returned))
          await recordAuthAudit(prisma, 'AUTH_PASSWORD_RESET_COMPLETED', {
            metadata: { sessionPolicy: 'REVOKE_ALL' },
          });
        if (context.path === '/two-factor/enable' && !isAPIError(context.context.returned)) {
          const actorId = context.context.session?.user.id;
          await prisma.securityEvent.create({
            data: {
              ...(actorId ? { actorId } : {}),
              eventType: 'AUTH_MFA_ENROLLMENT_INITIATED',
              category: 'MFA_ENROLLMENT',
              metadata: { method: 'TOTP' },
            },
          });
        }
        if (context.path === '/two-factor/verify-totp' && !isAPIError(context.context.returned)) {
          const session = context.context.session?.session;
          const user = context.context.session?.user;
          if (session && user) {
            const staff = await prisma.user.findFirst({
              where: {
                id: user.id,
                role: { in: ['ADMIN', 'CONSULTANT'] },
                twoFactorEnabled: true,
              },
              select: { id: true },
            });
            if (staff) {
              const verifiedAt = new Date();
              const updated = await prisma.betterAuthSession.updateMany({
                where: { id: session.id, userId: staff.id },
                data: { staffMfaVerifiedAt: verifiedAt },
              });
              if (updated.count > 0)
                await prisma.securityEvent.create({
                  data: {
                    actorId: staff.id,
                    eventType: 'AUTH_MFA_CHALLENGE_SUCCEEDED',
                    category: 'MFA_CHALLENGE',
                    metadata: { method: 'TOTP', sessionId: session.id },
                  },
                });
            }
          }
        }
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
          before: async (user) => {
            return { data: { ...user, name: user.name.trim() } };
          },
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
            await bindClaimedGoalIntake(prisma, user.email, client.id, user.id);
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
            if (context?.path === '/two-factor/verify-totp' && user.twoFactorEnabled)
              await prisma.securityEvent.create({
                data: {
                  actorId: user.id,
                  eventType: 'AUTH_MFA_ENROLLMENT_COMPLETED',
                  category: 'MFA_ENROLLMENT',
                  metadata: { method: 'TOTP' },
                },
              });
          },
        },
      },
      session: {
        create: {
          before: async (session, context) => ({
            data: {
              ...session,
              ...(context?.path === '/two-factor/verify-totp'
                ? { staffMfaVerifiedAt: new Date() }
                : {}),
            },
          }),
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
            if (context?.path === '/two-factor/verify-totp')
              await prisma.securityEvent.create({
                data: {
                  actorId: session.userId,
                  eventType: 'AUTH_MFA_CHALLENGE_SUCCEEDED',
                  category: 'MFA_CHALLENGE',
                  metadata: { method: 'TOTP' },
                },
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

export function deriveMfaAssurance(
  role: 'CLIENT' | 'CONSULTANT' | 'ADMIN',
  twoFactorEnabled: boolean,
  verifiedAt: Date | null | undefined,
  ttlMinutes: number,
  now = Date.now(),
) {
  if (role === 'CLIENT') return { staffMfaVerified: true, stepUpVerified: true };
  const staffMfaVerified = Boolean(twoFactorEnabled && verifiedAt);
  return {
    staffMfaVerified,
    stepUpVerified: Boolean(
      staffMfaVerified && verifiedAt && now - verifiedAt.getTime() <= ttlMinutes * 60_000,
    ),
  };
}

export async function resolveBetterAuthPrincipal(
  auth: BetterAuthInstance,
  prisma: PrismaClient,
  headers: IncomingHttpHeaders,
  mfaStepUpTtlMinutes = 15,
) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      twoFactorEnabled: true,
      client: { select: { id: true } },
    },
  });
  if (!user || user.status !== 'ACTIVE') return null;
  const staffMfaVerifiedAt = (
    session.session as typeof session.session & { staffMfaVerifiedAt?: Date | null }
  ).staffMfaVerifiedAt;
  const assurance = deriveMfaAssurance(
    user.role,
    user.twoFactorEnabled,
    staffMfaVerifiedAt ? new Date(staffMfaVerifiedAt) : null,
    mfaStepUpTtlMinutes,
  );
  return {
    sessionId: session.session.id,
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    clientId: user.client?.id ?? null,
    staffMfaEnabled: user.twoFactorEnabled,
    ...assurance,
  };
}
