import { expect, test } from 'vitest';
import { conflictChoices, resolvePlanText } from './PlanConflictResolution';
import { type PlanDraft } from './editor';
const saved: PlanDraft = {
  title: 'Saved title',
  purpose: 'NURTURE',
  sourceReviewId: null,
  sourceReviewVersion: 4,
  sourceGoalRevisionId: null,
  sourceProfileVersion: 8,
  items: [
    {
      stableKey: 'one',
      type: 'ACTION',
      completionMode: 'STRUCTURED_OUTCOME',
      owner: 'CLIENT',
      clientTitle: 'Saved step',
      clientBody: 'Saved instructions',
      consultantRationale: 'Saved rationale',
      required: true,
      sortOrder: 0,
      pathKeys: [],
      status: 'AVAILABLE',
      outcomeSchema: { type: 'object' },
    },
  ],
  paths: [],
  groups: [],
};
test('carries only selected wording while preserving newer structure, source and response schema', () => {
  const local = structuredClone(saved);
  local.title = 'Local title';
  local.items[0]!.clientBody = 'Local instructions';
  local.items[0]!.consultantRationale = 'Local rationale';
  local.sourceProfileVersion = 1;
  local.items[0]!.outcomeSchema = { type: 'string' };
  const result = resolvePlanText(local, saved, ['one:clientBody', 'sourceProfileVersion']);
  expect(result.title).toBe('Saved title');
  expect(result.items[0]!.clientBody).toBe('Local instructions');
  expect(result.items[0]!.consultantRationale).toBe('Saved rationale');
  expect(result.items[0]!.outcomeSchema).toEqual({ type: 'object' });
  expect(result.sourceProfileVersion).toBe(8);
  expect(saved.items[0]!.clientBody).toBe('Saved instructions');
});
test('does not carry wording onto removed steps or steps with newly recorded progress', () => {
  const local = structuredClone(saved);
  local.items[0]!.clientBody = 'Changed';
  const progressed = structuredClone(saved);
  progressed.items[0]!.status = 'COMPLETED';
  expect(conflictChoices(local, progressed)).toEqual([]);
  expect(resolvePlanText(local, progressed, ['one:clientBody'])).toEqual(progressed);
  expect(resolvePlanText(local, { ...saved, items: [] }, ['one:clientBody']).items).toEqual([]);
});
