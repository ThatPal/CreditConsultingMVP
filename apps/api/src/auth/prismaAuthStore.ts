import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthStore, PublicUser } from './types.js';

const publicUserSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  client: { select: { id: true, firstName: true, lastName: true, phone: true, timezone: true } },
} as const;

function toPublicUser(user: {
  id: string;
  email: string;
  role: 'CLIENT' | 'CONSULTANT' | 'ADMIN';
  status: 'ACTIVE' | 'DISABLED' | 'INVITED';
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    timezone: string;
  } | null;
}): PublicUser {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    clientId: user.client?.id ?? null,
    firstName: user.client?.firstName ?? null,
    lastName: user.client?.lastName ?? null,
    phone: user.client?.phone ?? null,
    timezone: user.client?.timezone ?? null,
  };
}

export function createPrismaAuthStore(prisma: PrismaClient): AuthStore {
  return {
    findUserByEmail: (email) =>
      prisma.user.findUnique({ where: { email }, include: { client: { select: { id: true } } } }),
    async createClientUser(input) {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          role: 'CLIENT',
          client: {
            create: {
              firstName: input.firstName,
              lastName: input.lastName,
              ...(input.phone ? { phone: input.phone } : {}),
              timezone: input.timezone,
              termsAcceptedAt: input.termsAcceptedAt,
              ...(input.goals?.length
                ? {
                    goals: {
                      create: input.goals.map((goal) => ({
                        goalType: goal.goalType,
                        scope: goal.scope,
                        priority: goal.priority,
                        ...(goal.targetAmount !== undefined
                          ? { targetAmount: goal.targetAmount }
                          : {}),
                      })),
                    },
                  }
                : {}),
            },
          },
        },
        select: publicUserSelect,
      });
      return toPublicUser(user);
    },
    async createSession(input) {
      await prisma.authSession.create({ data: input });
    },
    async findSession(tokenHash) {
      const session = await prisma.authSession.findUnique({
        where: { tokenHash },
        include: { user: { include: { client: { select: { id: true } } } } },
      });
      if (!session) return null;
      return {
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        principal: {
          userId: session.user.id,
          email: session.user.email,
          role: session.user.role,
          status: session.user.status,
          clientId: session.user.client?.id ?? null,
        },
      };
    },
    async revokeSession(tokenHash) {
      await prisma.authSession.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
    async revokeAllSessions(userId) {
      await prisma.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
    async markLogin(userId, at) {
      await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
    },
    async getPublicUser(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      });
      return user ? toPublicUser(user) : null;
    },
    async updateClientProfile(userId, input) {
      const profile = {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      };
      const user = await prisma.user.update({
        where: { id: userId },
        data: { client: { update: profile } },
        select: publicUserSelect,
      });
      return toPublicUser(user);
    },
    async canAccessClient(principal, clientId) {
      if (principal.role === 'ADMIN') return true;
      if (principal.role === 'CLIENT') return principal.clientId === clientId;
      const assigned = await prisma.client.count({
        where: { id: clientId, assignedConsultantId: principal.userId, archivedAt: null },
      });
      return assigned === 1;
    },
    async replacePasswordResetToken(input) {
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: input.userId, usedAt: null } }),
        prisma.passwordResetToken.create({ data: input }),
      ]);
    },
    async consumePasswordResetToken(tokenHash, passwordHash, now) {
      return prisma.$transaction(async (tx) => {
        const token = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
        if (!token || token.usedAt || token.expiresAt <= now) return null;
        const claimed = await tx.passwordResetToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (claimed.count !== 1) return null;
        await tx.user.update({
          where: { id: token.userId },
          data: { passwordHash, status: 'ACTIVE' },
        });
        await tx.authSession.updateMany({
          where: { userId: token.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        return token.userId;
      });
    },
  };
}
