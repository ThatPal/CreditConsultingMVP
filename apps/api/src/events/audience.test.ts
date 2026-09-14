import { expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import type { LiveEventEnvelope } from '@credit/shared';
import { matchesLiveAudience } from './audience.js';
const principal = {
  userId: 'owner',
  clientId: 'client',
  role: 'CLIENT',
  status: 'ACTIVE',
} as AuthPrincipal;
const event = {
  clientId: 'client',
  domains: ['plan-drafts'],
  targetUserId: 'owner',
} as LiveEventEnvelope;
test('private draft activity is restricted to its active owning client account', () => {
  expect(matchesLiveAudience(principal, event)).toBe(true);
  for (const change of [
    { userId: 'other' },
    { clientId: 'other' },
    { role: 'CONSULTANT' },
    { role: 'ADMIN' },
    { status: 'DISABLED' },
  ])
    expect(matchesLiveAudience({ ...principal, ...change } as AuthPrincipal, event)).toBe(false);
});
test('private hints fail closed when their audience is absent or malformed', () => {
  for (const targetUserId of [undefined, null, '', 12])
    expect(matchesLiveAudience(principal, { ...event, targetUserId } as LiveEventEnvelope)).toBe(
      false,
    );
  expect(
    matchesLiveAudience(principal, { ...event, domains: ['plan'], targetUserId: undefined } as unknown as LiveEventEnvelope),
  ).toBe(true);
});
