import { describe, expect, test } from 'vitest';
import { liveConnectionCopy, queryRootsForLiveDomains } from './LiveUpdates';
import { readableOfferFacts } from './pages/LivePages';

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

  test('never describes a reconnecting transport as live', () => {
    expect(liveConnectionCopy('connected')).toContain('connected');
    expect(liveConnectionCopy('reconnecting')).toContain('last confirmed state');
    expect(liveConnectionCopy('reconnecting')).not.toContain('updates are connected');
  });

  test('presents frozen offer facts without raw JSON', () => {
    expect(readableOfferFacts({ annualFee: 0, nested: { ignored: true } })).toEqual([
      { label: 'Annual Fee', value: '0' },
    ]);
  });
});
