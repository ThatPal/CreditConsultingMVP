import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test } from 'vitest';
import { queryRootsForLiveDomains } from '../LiveUpdates';
import { creditWorkspaceKeys, invalidateCreditWorkspace } from './creditWorkspace';

describe('U1 reference query boundary', () => {
  test('Plan mutation invalidates all reference projections while retaining unrelated cache', async () => {
    const client = new QueryClient();
    const keys = [
      creditWorkspaceKeys.home(),
      creditWorkspaceKeys.journey(),
      creditWorkspaceKeys.plan(),
      creditWorkspaceKeys.creditCenter(),
      creditWorkspaceKeys.consultantCreditCenter('client-a'),
      creditWorkspaceKeys.consultantJourney('client-a'),
    ];
    for (const key of keys) client.setQueryData(key, { confirmed: true });
    client.setQueryData(['payments'], { unchanged: true });
    client.setQueryData(['current-user'], { unchanged: true });
    await invalidateCreditWorkspace(client);
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(['payments'])?.isInvalidated).toBe(false);
    expect(client.getQueryState(['current-user'])?.isInvalidated).toBe(false);
    client.clear();
  });

  test.each([
    'review',
    'credit-profile',
    'plan',
    'strategy',
    'appointments',
    'live-sessions',
    'major-readiness',
    'services',
    'application-cycles',
    'journey',
    'home',
  ] as const)('%s hints refresh Home, Center and Plan together', (domain) => {
    const roots = queryRootsForLiveDomains([domain]);
    expect(roots).toEqual(
      expect.arrayContaining([
        creditWorkspaceKeys.home()[0],
        creditWorkspaceKeys.creditCenter()[0],
        creditWorkspaceKeys.plan()[0],
      ]),
    );
    expect(new Set(roots).size).toBe(roots.length);
    expect(roots).not.toContain('payments');
  });

  test('private response draft hints stay local; consultant keys retain client identity', () => {
    expect(queryRootsForLiveDomains(['plan-drafts'])).not.toContain(creditWorkspaceKeys.home()[0]);
    expect(creditWorkspaceKeys.consultantCreditCenter('client-a')).not.toEqual(
      creditWorkspaceKeys.consultantCreditCenter('client-b'),
    );
    expect(creditWorkspaceKeys.consultantJourney('client-a')).not.toEqual(
      creditWorkspaceKeys.consultantJourney('client-b'),
    );
  });
});
