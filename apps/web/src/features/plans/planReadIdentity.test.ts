import { expect, test } from 'vitest';
import { planReadIdentity } from './planReadIdentity';
const data = {
  workspace: {
    generatedAt: 'first',
    refreshAt: 'soon',
    currentFocus: { code: 'PLAN_ACTION' },
    profile: { status: 'CURRENT' },
  },
  summary: { canRespond: true },
  plan: { version: { id: 'version', items: [{ id: 'step', body: 'Original instruction' }] } },
};
test('read timing alone does not invalidate an in-progress response', () => {
  expect(planReadIdentity(data)).toBe(
    planReadIdentity({
      ...data,
      workspace: { ...data.workspace, generatedAt: 'later', refreshAt: null },
    }),
  );
});
test('focus, currentness, permissions and instructions remain significant', () => {
  for (const changed of [
    { ...data, workspace: { ...data.workspace, currentFocus: { code: 'LIVE_RETURN' } } },
    { ...data, workspace: { ...data.workspace, profile: { status: 'STALE' } } },
    { ...data, summary: { canRespond: false } },
    {
      ...data,
      plan: { version: { id: 'version', items: [{ id: 'step', body: 'New instruction' }] } },
    },
  ])
    expect(planReadIdentity(changed)).not.toBe(planReadIdentity(data));
  expect(planReadIdentity(undefined)).not.toBe(planReadIdentity(data));
});
