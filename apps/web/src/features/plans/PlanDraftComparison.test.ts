import { expect, test } from 'vitest';
import { comparePlanDrafts } from './PlanDraftComparison';
import { type PlanDraft } from './editor';
const draft: PlanDraft = {
  title: 'Prepare',
  purpose: 'NURTURE',
  sourceReviewId: null,
  sourceReviewVersion: null,
  sourceGoalRevisionId: null,
  sourceProfileVersion: 1,
  items: ['one', 'two'].map((stableKey) => ({
    stableKey,
    type: 'ACTION',
    completionMode: 'ACKNOWLEDGEMENT',
    owner: 'CLIENT',
    clientTitle: stableKey,
    clientBody: 'Instructions',
    consultantRationale: null,
    required: true,
    sortOrder: 0,
    pathKeys: [],
  })),
  paths: [],
  groups: [],
};
test('compares stable step identities, removed steps, source versions and dependency rules', () => {
  const changed = structuredClone(draft);
  changed.items.reverse();
  changed.items[0]!.clientBody = 'Changed instructions';
  changed.sourceProfileVersion = 2;
  changed.groups = [{ key: 'g', dependentKey: 'two', mode: 'ALL', prerequisites: ['one'] }];
  const rows = comparePlanDrafts(changed, draft);
  expect(rows.filter((row) => row.field === 'Position')).toHaveLength(2);
  expect(rows.find((row) => row.field === 'Instructions')).toMatchObject({
    section: 'two',
    local: 'Changed instructions',
  });
  expect(rows.find((row) => row.field === 'Prerequisites')?.local).toContain('All required');
  expect(rows.some((row) => row.field === 'Profile version')).toBe(true);
  changed.items.pop();
  expect(
    comparePlanDrafts(changed, draft).some(
      (row) => row.field === 'Included in Plan' && row.local === 'No',
    ),
  ).toBe(true);
});
test('object key order alone does not create response-form differences', () => {
  const left = structuredClone(draft),
    right = structuredClone(draft);
  left.items[0]!.outcomeSchema = {
    type: 'object',
    properties: { answer: { title: 'Answer', type: 'string' } },
  };
  right.items[0]!.outcomeSchema = {
    properties: { answer: { type: 'string', title: 'Answer' } },
    type: 'object',
  };
  expect(comparePlanDrafts(left, right)).toEqual([]);
});
