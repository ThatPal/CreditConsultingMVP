import { describe, expect, test, vi } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import {
  createAuthorizationService,
  createRealtimeAuthorizationBridge,
} from './authorizationService.js';

const consultant: AuthPrincipal = {
  userId: 'consultant-a',
  email: 'consultant@example.com',
  role: 'CONSULTANT',
  status: 'ACTIVE',
  clientId: null,
  staffMfaEnabled: true,
  staffMfaVerified: true,
  stepUpVerified: true,
};

function fixture() {
  let assigned = true;
  let granted = false;
  const store = {
    hasRoleCapability: vi.fn(
      async (role: string, capability: string) =>
        (role === 'CONSULTANT' && ['client.read', 'review.publish'].includes(capability)) ||
        (role === 'ADMIN' && ['settings.manage', 'review.publish'].includes(capability)),
    ),
    hasActiveAssignment: vi.fn(async () => assigned),
    hasActiveGrant: vi.fn(async () => granted),
  };
  return {
    service: createAuthorizationService(store),
    revokeAssignment: () => {
      assigned = false;
    },
    grant: () => {
      granted = true;
    },
    revokeGrant: () => {
      granted = false;
    },
  };
}

describe('canonical authorization boundary', () => {
  test('requires active status and server-established staff MFA', async () => {
    const { service } = fixture();
    await expect(
      service.authorize({ ...consultant, status: 'SUSPENDED' }, 'client.read', {
        type: 'client',
        clientId: 'a',
      }),
    ).resolves.toBe(false);
    await expect(
      service.authorize({ ...consultant, staffMfaVerified: false }, 'client.read', {
        type: 'client',
        clientId: 'a',
      }),
    ).resolves.toBe(false);
  });

  test('isolates assignments and applies revocation immediately to realtime', async () => {
    const state = fixture();
    const realtime = createRealtimeAuthorizationBridge(state.service);
    await expect(realtime.canSubscribeToClient(consultant, 'assigned-client')).resolves.toBe(true);
    state.revokeAssignment();
    await expect(realtime.canSubscribeToClient(consultant, 'assigned-client')).resolves.toBe(false);
  });

  test('does not make Admin a Consultant and requires a client grant', async () => {
    const state = fixture();
    const admin = { ...consultant, role: 'ADMIN' as const };
    state.revokeAssignment();
    await expect(
      state.service.authorize(admin, 'settings.manage', { type: 'platform' }),
    ).resolves.toBe(true);
    await expect(
      state.service.authorize(admin, 'review.publish', { type: 'client', clientId: 'a' }),
    ).resolves.toBe(false);
    state.grant();
    await expect(
      state.service.authorize(admin, 'review.publish', { type: 'client', clientId: 'a' }),
    ).resolves.toBe(true);
    state.revokeGrant();
    await expect(
      state.service.authorize(admin, 'review.publish', { type: 'client', clientId: 'a' }),
    ).resolves.toBe(false);
  });

  test('requires fresh step-up assurance for sensitive operations', async () => {
    const { service } = fixture();
    await expect(
      service.authorize(
        { ...consultant, stepUpVerified: false },
        'review.publish',
        { type: 'client', clientId: 'a' },
        { requireStepUp: true },
      ),
    ).resolves.toBe(false);
  });
});
