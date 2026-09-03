import { describe, expect, test } from 'vitest';
import { evaluateFrozenRule } from './decisions.js';

describe('frozen live execution policy', () => {
  const rules = {
    onApproved: 'continue',
    onDeclined: 'stop',
    onPending: 'review',
    onSkipped: 'continue',
    onNotCompleted: 'review',
    onUnexpected: 'review',
  };

  test('maps ordinary outcomes deterministically without AI', () => {
    expect(evaluateFrozenRule(rules, 'APPROVED', true).decisionType).toBe(
      'READY_TO_RELEASE_ALLOWED_CARD',
    );
    expect(evaluateFrozenRule(rules, 'DECLINED', true).decisionType).toBe(
      'STOP_APPLICATION_SEQUENCE',
    );
    expect(evaluateFrozenRule(rules, 'PENDING', true).decisionType).toBe('WAIT_FOR_CLIENT_RESULT');
    expect(evaluateFrozenRule(rules, 'SKIPPED', false).decisionType).toBe('END_SESSION_READY');
    expect(evaluateFrozenRule(rules, 'TECHNICAL_ISSUE', true).decisionType).toBe(
      'INTERVENTION_REQUIRED',
    );
  });

  test('fails safely on missing, ambiguous, or unexpected rules', () => {
    expect(evaluateFrozenRule({}, 'OTHER', true).decisionType).toBe('INTERVENTION_REQUIRED');
    expect(
      evaluateFrozenRule({ onApproved: { arbitrary: 'code' } }, 'APPROVED', true).decisionType,
    ).toBe('INTERVENTION_REQUIRED');
  });
});
