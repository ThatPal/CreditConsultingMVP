import type { UserRole, UserStatus } from '../generated/prisma/enums.js';

export type AuthPrincipal = {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  clientId: string | null;
};

export type PublicUser = AuthPrincipal & {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  timezone: string | null;
};

export type SessionRecord = { principal: AuthPrincipal; expiresAt: Date; revokedAt: Date | null };

export interface AuthStore {
  findUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    passwordHash: string | null;
    role: UserRole;
    status: UserStatus;
    client: { id: string } | null;
  } | null>;
  createClientUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string | undefined;
    timezone: string;
    termsAcceptedAt: Date;
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
  }): Promise<AuthPrincipal>;
  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
  }): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
  markLogin(userId: string, at: Date): Promise<void>;
  getPublicUser(userId: string): Promise<PublicUser | null>;
  updateClientProfile(
    userId: string,
    input: {
      firstName?: string | undefined;
      lastName?: string | undefined;
      phone?: string | null | undefined;
      timezone?: string | undefined;
    },
  ): Promise<PublicUser>;
  canAccessClient(principal: AuthPrincipal, clientId: string): Promise<boolean>;
  replacePasswordResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  consumePasswordResetToken(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<string | null>;
}
