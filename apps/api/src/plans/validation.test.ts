import { describe, expect, test } from 'vitest';
import { prerequisitesSatisfied, validatePlanGraph, type PlanGraphItem } from './validation.js';

const action = (id: string, pathKeys: string[] = []): PlanGraphItem => ({
  id,
  type: 'ACTION',
  completionMode: 'ACKNOWLEDGEMENT',
  required: true,
  pathKeys,
});

describe('canonical Plan validation', () => {
  test('accepts a linear dependency graph independent of display order', () => {
    const dependencies = [
      { dependentItemId: 'second', prerequisiteItemId: 'first', groupKey: 'default', mode: 'ALL' as const },
    ];
    expect(validatePlanGraph({ items: [action('second'), action('first')], dependencies })).toEqual({ valid: true, issues: [] });
    expect(prerequisitesSatisfied('second', dependencies, new Set())).toBe(false);
    expect(prerequisitesSatisfied('second', dependencies, new Set(['first']))).toBe(true);
  });

  test('accepts a governed alternate path and rejects duplicate active paths', () => {
    const items = [action('a', ['fast']), action('b', ['careful'])];
    expect(validatePlanGraph({ items, dependencies: [], activePathKeys: ['fast'] }).valid).toBe(false);
    expect(validatePlanGraph({ items: items.map((item) => ({ ...item, required: false })), dependencies: [], activePathKeys: ['fast'] }).valid).toBe(true);
    expect(validatePlanGraph({ items, dependencies: [], activePathKeys: ['fast', 'careful'] }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_ACTIVE_PATH' })]));
  });

  test.each([
    ['self dependency', [action('a')], [{ dependentItemId: 'a', prerequisiteItemId: 'a', groupKey: 'd', mode: 'ALL' as const }], 'SELF_DEPENDENCY'],
    ['cycle', [action('a'), action('b')], [
      { dependentItemId: 'a', prerequisiteItemId: 'b', groupKey: 'd', mode: 'ALL' as const },
      { dependentItemId: 'b', prerequisiteItemId: 'a', groupKey: 'd', mode: 'ALL' as const },
    ], 'CIRCULAR_DEPENDENCY'],
  ])('rejects %s', (_name, items, dependencies, code) => {
    expect(validatePlanGraph({ items, dependencies }).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  test('rejects invalid type/completion combinations and cross-path dependencies', () => {
    const guidance: PlanGraphItem = { ...action('guide', ['one']), type: 'GUIDANCE', completionMode: 'SYSTEM_VERIFY' };
    const milestone: PlanGraphItem = { ...action('milestone', ['two']), type: 'MILESTONE', completionMode: 'SYSTEM_VERIFY' };
    const result = validatePlanGraph({
      items: [guidance, milestone],
      dependencies: [{ dependentItemId: 'milestone', prerequisiteItemId: 'guide', groupKey: 'd', mode: 'ALL' }],
      activePathKeys: ['two'],
    });
    expect(result.issues.map(({ code }) => code).sort()).toEqual(expect.arrayContaining(['INVALID_COMPLETION_MODE', 'INVALID_CROSS_PATH_DEPENDENCY']));
  });
});
