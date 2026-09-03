import { describe, expect, test } from 'vitest';
import { aggregateRoundFacts } from './summary.js';
const fact = (outcome: any, approvedLimitKnown: boolean | null = null, approvedLimit: number | null = null, status = 'RESULT_RECORDED') => ({ status, outcome, approvedLimitKnown, approvedLimit: approvedLimit === null ? null : { toString: () => String(approvedLimit) } });
describe('post-round canonical aggregation', () => {
  test('counts only known positive approvals and keeps skip outside submitted applications', () => {
    const result = aggregateRoundFacts([fact('APPROVED', true, 5000), fact('APPROVED', false), fact('PENDING'), fact('DECLINED'), fact(null, null, null, 'SKIPPED'), fact('TECHNICAL_ISSUE')], 10000);
    expect(result.counts).toEqual({ submitted: 5, approved: 2, approvedLimitPending: 1, declined: 1, pending: 1, other: 1, skipped: 1 });
    expect(result.knownApprovedAmount).toBe(5000); expect(result.goal?.progressPercent).toBe(50); expect(result.unresolvedFollowUpCount).toBe(2);
  });
});
