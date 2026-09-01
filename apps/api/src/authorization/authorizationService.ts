import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';

export const canonicalCapabilities = [
  'client.read',
  'client.manage',
  'review.read',
  'review.publish',
  'support.read',
  'support.manage',
  'document.read',
  'document.manage',
  'settings.manage',
  'commerce.manage',
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
  authorizeCapability(
    principal: AuthPrincipal,
    capability: Capability,
    options?: { requireStepUp?: boolean },
  ): Promise<boolean>;
  authorize(
    principal: AuthPrincipal,
    capability: Capability,
    resource: ResourceScope,
    options?: { requireStepUp?: boolean; at?: Date },
  ): Promise<boolean>;
}

const clientSelfCapabilities = new Set<Capability>([
  'client.read',
  'review.read',
  'support.read',
  'document.read',
  'document.manage',
]);
const platformCapabilities = new Set<Capability>([
  'settings.manage',
  'commerce.manage',
  'audit.read_platform',
]);

export function createAuthorizationService(store: AuthorizationAccessStore): AuthorizationService {
  async function authorizeCapability(
    principal: AuthPrincipal,
    capability: Capability,
    options?: { requireStepUp?: boolean },
  ) {
    if (principal.status !== 'ACTIVE') return false;
    if (principal.role !== 'CLIENT' && !principal.staffMfaVerified) return false;
    if (options?.requireStepUp && !principal.stepUpVerified) return false;
    return store.hasRoleCapability(principal.role, capability);
  }

  return {
    authorizeCapability,
    async authorize(principal, capability, resource, options) {
      if (!(await authorizeCapability(principal, capability, options))) return false;

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

export function createPrismaAuthorizationDenialRecorder(
  prisma: PrismaClient,
): AuthorizationDenialRecorder {
  return async ({ principal, capability, resource, category }) => {
    await prisma.securityEvent.create({
      data: {
        actorId: principal.userId,
        ...(resource.type === 'client' && resource.clientId !== 'invalid'
          ? { clientId: resource.clientId }
          : {}),
        eventType: 'AUTHZ_ACCESS_DENIED',
        severity: category === 'AUTHORIZATION_LOOKUP_FAILED' ? 'HIGH' : 'WARNING',
        category,
        entityType: resource.type === 'client' ? 'Client' : 'Platform',
        ...(resource.type === 'client' && resource.clientId !== 'invalid'
          ? { entityId: resource.clientId }
          : {}),
        metadata: { capability, role: principal.role },
      },
    });
  };
}

export function createRealtimeAuthorizationBridge(service: AuthorizationService) {
  return {
    canSubscribeToClient(principal: AuthPrincipal, clientId: string) {
      return service.authorize(principal, 'client.read', { type: 'client', clientId });
    },
  };
}
