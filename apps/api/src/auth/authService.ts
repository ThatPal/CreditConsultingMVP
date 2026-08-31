import { AppError } from '../http/errors.js';
import type { AppEnv } from '../config/env.js';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from './security.js';
import type { AuthPrincipal, AuthStore, PublicUser } from './types.js';

export type ResetNotifier = (message: {
  email: string;
  resetUrl: string;
  expiresAt: Date;
}) => Promise<void>;

export function createAuthService(
  store: AuthStore,
  env: Pick<AppEnv, 'SESSION_TTL_HOURS' | 'PASSWORD_RESET_TTL_MINUTES' | 'PASSWORD_RESET_BASE_URL'>,
  notifyReset: ResetNotifier,
) {
  const sessionExpiry = () => new Date(Date.now() + env.SESSION_TTL_HOURS * 3_600_000);
  async function issueSession(principal: AuthPrincipal, userAgent?: string) {
    const token = createOpaqueToken();
    const expiresAt = sessionExpiry();
    await store.createSession({
      userId: principal.userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt,
      ...(userAgent ? { userAgent } : {}),
    });
    return { token, expiresAt, principal };
  }
  return {
    async register(
      input: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        phone?: string | undefined;
        timezone: string;
        termsAccepted: boolean;
        goals?: Array<{
          goalType:
            | 'ZERO_APR_CREDIT'
            | 'TOTAL_AVAILABLE_CREDIT'
            | 'BUSINESS_CREDIT'
            | 'PERSONAL_CREDIT'
            | 'BALANCE_TRANSFER_CAPACITY'
            | 'EXISTING_LIMIT_INCREASES'
            | 'REWARDS_POINTS_PORTFOLIO';
          scope: 'PERSONAL' | 'BUSINESS' | 'BOTH';
          targetAmount?: number | undefined;
          priority: 'PRIMARY' | 'SECONDARY';
        }>;
      },
      userAgent?: string,
    ) {
      if (!input.termsAccepted)
        throw new AppError('VALIDATION_ERROR', 400, 'Terms acceptance is required');
      const email = normalizeEmail(input.email);
      if (await store.findUserByEmail(email))
        throw new AppError(
          'EMAIL_ALREADY_EXISTS',
          409,
          'An account with this email already exists',
        );
      const passwordHash = await hashPassword(input.password);
      let principal: AuthPrincipal;
      try {
        principal = await store.createClientUser({
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          ...(input.phone ? { phone: input.phone.trim() } : {}),
          timezone: input.timezone,
          termsAcceptedAt: new Date(),
          ...(input.goals ? { goals: input.goals } : {}),
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
          throw new AppError(
            'EMAIL_ALREADY_EXISTS',
            409,
            'An account with this email already exists',
          );
        throw error;
      }
      return issueSession(principal, userAgent);
    },
    async login(emailInput: string, password: string, userAgent?: string) {
      const user = await store.findUserByEmail(normalizeEmail(emailInput));
      const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, password) : false;
      if (!user || !valid)
        throw new AppError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect');
      if (user.status !== 'ACTIVE')
        throw new AppError('ACCOUNT_UNAVAILABLE', 403, 'This account is not available');
      const principal = {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        clientId: user.client?.id ?? null,
      };
      await store.markLogin(user.id, new Date());
      return issueSession(principal, userAgent);
    },
    async authenticate(token: string | undefined): Promise<AuthPrincipal | null> {
      if (!token) return null;
      const session = await store.findSession(hashOpaqueToken(token));
      if (
        !session ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        session.principal.status !== 'ACTIVE'
      )
        return null;
      return session.principal;
    },
    async logout(token: string | undefined) {
      if (token) await store.revokeSession(hashOpaqueToken(token));
    },
    getMe(userId: string): Promise<PublicUser | null> {
      return store.getPublicUser(userId);
    },
    updateMe(
      userId: string,
      input: {
        firstName?: string | undefined;
        lastName?: string | undefined;
        phone?: string | null | undefined;
        timezone?: string | undefined;
      },
    ) {
      return store.updateClientProfile(userId, input);
    },
    canAccessClient(principal: AuthPrincipal, clientId: string) {
      return store.canAccessClient(principal, clientId);
    },
    async forgotPassword(emailInput: string) {
      const email = normalizeEmail(emailInput);
      const user = await store.findUserByEmail(email);
      if (!user || !user.passwordHash || user.status === 'DISABLED') return;
      const token = createOpaqueToken();
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000);
      await store.replacePasswordResetToken({
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      });
      const url = new URL(env.PASSWORD_RESET_BASE_URL);
      url.searchParams.set('token', token);
      await notifyReset({ email, resetUrl: url.toString(), expiresAt });
    },
    async resetPassword(token: string, password: string) {
      const passwordHash = await hashPassword(password);
      const userId = await store.consumePasswordResetToken(
        hashOpaqueToken(token),
        passwordHash,
        new Date(),
      );
      if (!userId)
        throw new AppError(
          'RESET_TOKEN_INVALID',
          400,
          'This password reset link is invalid or expired',
        );
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
