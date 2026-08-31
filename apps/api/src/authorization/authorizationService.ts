import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/types.js';

export const canonicalCapabilities = [
  'client.read',
  'client.manage',
  'review.read',
  'review.publish',
  'support.read',
  'support.manage',
  'settings.manage',
  'audit.read_platform',
] as const;

export type Capability = (typeof canonicalCapabilities)[number];
export type ResourceScope = { type: 'client'; clientId: string } | { type: 'platform' };

export interface AuthorizationAccessStore {
  hasRoleCapability(role: AuthPrincipal['role'], capability: Capability): Promise<boolean>;
  hasActiveAssignment(userId: string, clientId: string, at: Date): Promise<boolean>;
  hasActiveGrant(
    userId: string,
    clientId: string,
    capability: Capability,
    at: Date,
  ): Promise<boolean>;
}

export interface AuthorizationService {
  authorize(
    principal: AuthPrincipal,
    capability: Capability,
    resource: ResourceScope,
    options?: { requireStepUp?: boolean; at?: Date },
  ): Promise<boolean>;
}

const clientSelfCapabilities = new Set<Capability>(['client.read', 'review.read', 'support.read']);
const platformCapabilities = new Set<Capability>(['settings.manage', 'audit.read_platform']);

export function createAuthorizationService(store: AuthorizationAccessStore): AuthorizationService {
  return {
    async authorize(principal, capability, resource, options) {
      if (principal.status !== 'ACTIVE') return false;
      if (principal.role !== 'CLIENT' && !principal.staffMfaVerified) return false;
      if (options?.requireStepUp && !principal.stepUpVerified) return false;
      if (!(await store.hasRoleCapability(principal.role, capability))) return false;

      if (resource.type === 'platform') {
        return principal.role === 'ADMIN' && platformCapabilities.has(capability);
      }

      if (principal.role === 'CLIENT') {
        return principal.clientId === resource.clientId && clientSelfCapabilities.has(capability);
      }

      const at = options?.at ?? new Date();
      if (
        principal.role === 'CONSULTANT' &&
        (await store.hasActiveAssignment(principal.userId, resource.clientId, at))
      ) {
        return true;
      }

      return store.hasActiveGrant(principal.userId, resource.clientId, capability, at);
    },
  };
}

export function createPrismaAuthorizationService(prisma: PrismaClient): AuthorizationService {
  return createAuthorizationService({
    async hasRoleCapability(role, capability) {
      return Boolean(
        await prisma.roleCapability.findUnique({
          where: { role_capability: { role, capability } },
          select: { id: true },
        }),
      );
    },
    async hasActiveAssignment(userId, clientId, at) {
      return Boolean(
        await prisma.staffClientAssignment.findFirst({
          where: {
            staffUserId: userId,
            clientId,
            activatedAt: { lte: at },
            deactivatedAt: null,
          },
          select: { id: true },
        }),
      );
    },
    async hasActiveGrant(userId, clientId, capability, at) {
      return Boolean(
        await prisma.clientAccessGrant.findFirst({
          where: {
            granteeId: userId,
            clientId,
            startsAt: { lte: at },
            expiresAt: { gt: at },
            revokedAt: null,
            allowedCapabilities: { has: capability },
          },
          select: { id: true },
        }),
      );
    },
  });
}

export function createRealtimeAuthorizationBridge(service: AuthorizationService) {
  return {
    canSubscribeToClient(principal: AuthPrincipal, clientId: string) {
      return service.authorize(principal, 'client.read', { type: 'client', clientId });
    },
  };
}
