import { describe, expect, test } from 'vitest';
import { queryRootsForLiveDomains } from './LiveUpdates';

describe('targeted realtime invalidation', () => {
  test('maps live and work-queue events only to their affected query families', () => {
    expect(queryRootsForLiveDomains(['live-sessions', 'work-queue'])).toEqual([
      'live-session',
      'live-sessions',
      'work-queue',
    ]);
    expect(queryRootsForLiveDomains(['live-sessions'])).not.toContain('payments');
    expect(queryRootsForLiveDomains(['live-sessions'])).not.toContain('documents');
  });

  test('deduplicates overlapping query roots', () => {
    expect(queryRootsForLiveDomains(['plan', 'plan'])).toEqual([
      'plan',
      'post-round',
      'post-round-follow-ups',
    ]);
  });
});
