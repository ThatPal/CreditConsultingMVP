import { expect, test } from 'vitest';
import { workspaceAffordances } from './affordances.js';
const focus = { action: '/app/rounds/round/live', actionLabel: 'Return to session' };
const item = {
  id: 'item',
  title: 'Safe title',
  type: 'ACTION',
  owner: 'CLIENT',
  status: 'AVAILABLE',
  completionMode: 'ACKNOWLEDGEMENT',
};
const plan = {
  id: 'plan',
  status: 'ACTIVE',
  version: { id: 'version', version: 2, items: [item] },
};
test('navigation is distinct from commands and a Plan action retains its exact basis', () => {
  const result = workspaceAffordances({ currentFocus: focus, plan });
  expect(result.availableActions).toEqual([
    {
      code: 'OPEN_CURRENT_FOCUS',
      kind: 'NAVIGATION',
      label: 'Return to session',
      href: focus.action,
    },
    {
      code: 'COMPLETE_PLAN_ITEM',
      kind: 'COMMAND',
      source: { planId: 'plan', versionId: 'version', version: 2, itemId: 'item' },
      requiresRevalidation: true,
    },
    {
      code: 'REQUEST_PLAN_HELP',
      kind: 'COMMAND',
      source: { planId: 'plan', versionId: 'version', version: 2, itemId: 'item' },
      requiresRevalidation: true,
    },
  ]);
  expect(result.blockers).toEqual([]);
});
test.each(['LOCKED', 'AWAITING_VERIFICATION', 'UNABLE', 'COMPLETED', 'CANCELLED'])(
  'never offers response commands for %s',
  (status) => {
    const result = workspaceAffordances({
      currentFocus: focus,
      plan: { ...plan, version: { ...plan.version, items: [{ ...item, status }] } },
    });
    expect(result.availableActions.every((a) => a.kind === 'NAVIGATION')).toBe(true);
    expect(result.blockers).toHaveLength(['COMPLETED', 'CANCELLED'].includes(status) ? 0 : 1);
  },
);
test('a broken form allows help but does not expose diagnostics or unrelated row fields', () => {
  const result = workspaceAffordances({
    currentFocus: focus,
    plan: {
      ...plan,
      version: {
        ...plan.version,
        items: [
          {
            ...item,
            responseForm: { error: 'private diagnostic' },
            consultantRationale: 'private rationale',
          } as typeof item,
        ],
      },
    },
  });
  expect(result.availableActions.map((a) => a.code)).toEqual([
    'OPEN_CURRENT_FOCUS',
    'REQUEST_PLAN_HELP',
  ]);
  expect(result.blockers[0]?.code).toBe('FORM_CONFIGURATION_REQUIRED');
  expect(JSON.stringify(result)).not.toContain('private');
});
test.each(['CONSULTANT', 'SYSTEM'])('does not offer client response for %s-owned work', (owner) => {
  const result = workspaceAffordances({
    currentFocus: focus,
    plan: { ...plan, version: { ...plan.version, items: [{ ...item, owner }] } },
  });
  expect(result.availableActions).toHaveLength(1);
});
test('stale read withdraws actions without changing its source or navigation', () => {
  const result = workspaceAffordances({
    currentFocus: focus,
    plan: { ...plan, version: { ...plan.version, staleAt: new Date(), items: [item] } },
  });
  expect(result.availableActions).toHaveLength(1);
  expect(result.blockers[0]).toMatchObject({
    code: 'PLAN_READ_ONLY',
    scope: 'PLAN_RESPONSES',
    source: { versionId: 'version', itemId: null },
  });
});
test('missing Plan supplies navigation only and invents no payment or access requirement', () => {
  expect(workspaceAffordances({ currentFocus: focus, plan: null })).toEqual({
    availableActions: [
      {
        code: 'OPEN_CURRENT_FOCUS',
        kind: 'NAVIGATION',
        label: focus.actionLabel,
        href: focus.action,
      },
    ],
    blockers: [],
  });
});
