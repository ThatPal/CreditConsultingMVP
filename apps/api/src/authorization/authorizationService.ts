import type { AuthPrincipal } from '../auth/types.js';

export type Capability =
  | 'client:read'
  | 'client:manage'
  | 'review:read'
  | 'review:manage'
  | 'support:read'
  | 'support:manage'
  | 'commerce:manage';
export type ResourceScope = { type: 'client'; clientId: string } | { type: 'platform' };

export interface AuthorizationAccessStore {
  canAccessClient(principal: AuthPrincipal, clientId: string): Promise<boolean>;
}

export interface AuthorizationService {
  authorize(
    principal: AuthPrincipal,
    capability: Capability,
    resource: ResourceScope,
    options?: { staffMfaRequired?: boolean; staffMfaVerified?: boolean },
  ): Promise<boolean>;
}

const clientCapabilities = new Set<Capability>(['client:read', 'review:read', 'support:read']);
const consultantCapabilities = new Set<Capability>([
  'client:read',
  'client:manage',
  'review:read',
  'review:manage',
  'support:read',
  'support:manage',
]);

export function createAuthorizationService(store: AuthorizationAccessStore): AuthorizationService {
  return {
    async authorize(principal, capability, resource, options) {
      if (options?.staffMfaRequired && principal.role !== 'CLIENT' && !options.staffMfaVerified)
        return false;
      if (principal.role === 'ADMIN') return true;
      const capabilities =
        principal.role === 'CLIENT' ? clientCapabilities : consultantCapabilities;
      if (!capabilities.has(capability) || resource.type === 'platform') return false;
      return store.canAccessClient(principal, resource.clientId);
    },
  };
}
