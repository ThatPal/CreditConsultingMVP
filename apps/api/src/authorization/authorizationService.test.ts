import { describe, expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import { createAuthorizationService } from './authorizationService.js';

const consultant: AuthPrincipal = {
  userId: 'consultant-a',
  email: 'consultant@example.com',
  role: 'CONSULTANT',
  status: 'ACTIVE',
  clientId: null,
};

describe('canonical authorization boundary', () => {
  const service = createAuthorizationService({
    canAccessClient: async (principal, clientId) =>
      principal.role === 'CLIENT'
        ? principal.clientId === clientId
        : principal.userId === 'consultant-a' && clientId === 'assigned-client',
  });

  test('preserves consultant assignment isolation', async () => {
    await expect(
      service.authorize(consultant, 'review:manage', {
        type: 'client',
        clientId: 'assigned-client',
      }),
    ).resolves.toBe(true);
    await expect(
      service.authorize(consultant, 'review:manage', {
        type: 'client',
        clientId: 'another-client',
      }),
    ).resolves.toBe(false);
  });

  test('requires a verified staff MFA signal when a sensitive capability requests it', async () => {
    await expect(
      service.authorize(
        consultant,
        'review:manage',
        { type: 'client', clientId: 'assigned-client' },
        { staffMfaRequired: true, staffMfaVerified: false },
      ),
    ).resolves.toBe(false);
  });
});
