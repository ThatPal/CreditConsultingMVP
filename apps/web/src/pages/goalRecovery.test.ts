import { beforeEach, expect, test } from 'vitest';
import { goalRecoveryKey, readGoalRecovery, writeGoalRecovery } from './goalRecovery';
import { clearPlanTabRecovery } from '../auth/tabRecovery';
const key = goalRecoveryKey('actor', 'client', 'cycle');
const record = {
  phase: 'unknown' as const,
  savedAt: Date.now(),
  command: {
    path: '/api/v1/client/goals',
    method: 'POST',
    body: '{"targetAmount":50000}',
    key: 'request-id',
  },
};
beforeEach(() => sessionStorage.clear());
test('isolates actor, client and cycle and clears on session end', () => {
  expect(writeGoalRecovery(key, record)).toBe(true);
  expect(readGoalRecovery(key)).toEqual(record);
  expect(readGoalRecovery(goalRecoveryKey('other', 'client', 'cycle'))).toBeNull();
  expect(readGoalRecovery(goalRecoveryKey('actor', 'other', 'cycle'))).toBeNull();
  expect(readGoalRecovery(goalRecoveryKey('actor', 'client', 'other'))).toBeNull();
  clearPlanTabRecovery();
  expect(readGoalRecovery(key)).toBeNull();
});
test('rejects expired, malformed and non-goal commands', () => {
  for (const value of [
    { ...record, savedAt: Date.now() - 25 * 60 * 60 * 1000 },
    { ...record, command: { ...record.command, path: '/api/v1/documents' } },
    { ...record, command: { ...record.command, body: 'not-json' } },
  ]) {
    sessionStorage.setItem(key, JSON.stringify(value));
    expect(readGoalRecovery(key)).toBeNull();
  }
});
