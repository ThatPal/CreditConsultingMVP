import { expect, test } from 'vitest';
import { operationalBlockers } from './operationalBlockers.js';
test('preserves each restriction scope and exact case without broad Plan denial', () => {
  const result = operationalBlockers({
    restrictions: ['CYCLE', 'STRATEGY', 'SCHEDULING', 'LIVE_EXECUTION'].map((scope) => ({
      id: scope,
      caseId: 'case',
      decisionId: 'decision',
      scope,
    })),
  });
  expect(result.map((x) => x.scope)).toEqual(['CYCLE', 'STRATEGY', 'SCHEDULING', 'LIVE_EXECUTION']);
  expect(result.every((x) => x.href.endsWith('caseId=case'))).toBe(true);
  expect(result.every((x) => x.owner === 'CONSULTANT')).toBe(true);
});
test('projects blocked/stale/paused source separately and clears after source recovery', () => {
  expect(
    operationalBlockers({
      restrictions: [],
      round: { id: 'r', status: 'BLOCKED', strategy: { status: 'STALE' } },
      liveSession: { id: 's', roundId: 'r', version: 3, status: 'PAUSED' },
    }).map((x) => x.code),
  ).toEqual(['ROUND_BLOCKED', 'STRATEGY_STALE', 'LIVE_WAITING']);
  expect(
    operationalBlockers({
      restrictions: [],
      round: { id: 'r', status: 'ACTIVE', strategy: { status: 'APPROVED' } },
      liveSession: { id: 's', roundId: 'r', version: 4, status: 'LIVE' },
    }),
  ).toEqual([]);
});
