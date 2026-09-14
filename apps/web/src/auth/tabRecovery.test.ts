import { expect, test } from 'vitest';
import { clearPlanTabRecovery, planRecoveryKey } from './tabRecovery';
test('recovery keys isolate actors and clients; sign-out cleanup preserves unrelated storage', () => {
  sessionStorage.clear();
  const first = planRecoveryKey('first', 'client');
  const second = planRecoveryKey('second', 'client');
  expect(first).not.toBe(second);
  expect(first).not.toBe(planRecoveryKey('first', 'other'));
  sessionStorage.setItem(first, 'private');
  sessionStorage.setItem(second, 'private');
  sessionStorage.setItem('unrelated', 'keep');
  clearPlanTabRecovery();
  expect(sessionStorage.getItem(first)).toBeNull();
  expect(sessionStorage.getItem(second)).toBeNull();
  expect(sessionStorage.getItem('unrelated')).toBe('keep');
  sessionStorage.clear();
});
