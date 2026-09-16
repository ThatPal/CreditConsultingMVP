import { resolveCurrentFocus } from '../journey/projection.js';
import { expect, test } from 'vitest';
import { clientItemAvailability } from './clientAvailability.js';
import { summarizePlan } from '../workspace/projection.js';
const plan = { status: 'ACTIVE', staleAt: null };
const item = {
  id: 'step',
  title: 'Step',
  owner: 'CLIENT',
  type: 'ACTION',
  status: 'AVAILABLE',
  completionMode: 'ACKNOWLEDGEMENT',
};
test.each(['CONSULTANT_VERIFY', 'SYSTEM_VERIFY', 'UNKNOWN'])(
  'does not offer client responses for %s',
  (completionMode) => {
    const blocked = { ...item, completionMode };
    expect(clientItemAvailability(plan, blocked)).toMatchObject({
      canRespond: false,
      canSubmitCompletion: false,
      canRequestHelp: false,
      reason: 'VERIFICATION_REQUIRED',
    });
    expect(
      summarizePlan({
        status: 'ACTIVE',
        version: { items: [blocked, { ...item, id: 'client-step' }] },
      }).nextClientItem?.id,
    ).toBe('client-step');
  },
);
test.each([
  { ...item, owner: 'CONSULTANT' },
  { ...item, type: 'MILESTONE' },
  { ...item, status: 'LOCKED' },
  { ...item, status: 'AWAITING_VERIFICATION' },
  { ...item, status: 'COMPLETED' },
])('non-client or unavailable work has no response actions', (row) => {
  expect(clientItemAvailability(plan, row).canRespond).toBe(false);
});
test('stale Plan blocks otherwise available responses', () => {
  expect(clientItemAvailability({ ...plan, staleAt: new Date() }, item).reason).toBe(
    'PLAN_READ_ONLY',
  );
});
test('a broken form allows a help request but not completion', () => {
  expect(
    clientItemAvailability(plan, { ...item, responseForm: { error: 'Needs configuration' } }),
  ).toEqual({
    canRespond: true,
    canSubmitCompletion: false,
    canRequestHelp: true,
    reason: 'FORM_CONFIGURATION_REQUIRED',
  });
});

test.each(['CONSULTANT', 'SYSTEM'])(
  'verification focus names %s instead of offering a client step',
  (owner) => {
    const summary = summarizePlan({
      status: 'ACTIVE',
      version: { items: [{ ...item, owner, completionMode: owner + '_VERIFY' }] },
    });
    expect(
      resolveCurrentFocus({ activeNurture: null, activeCycle: null, hasGoal: true, plan: summary }),
    ).toMatchObject({ code: 'PLAN_CHECK', owner, action: '/app/plan' });
  },
);
