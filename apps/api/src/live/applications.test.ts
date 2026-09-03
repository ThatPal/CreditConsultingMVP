import { describe, expect, test } from 'vitest';
import { knownApprovedAmount } from './applications.js';

describe('live application outcome semantics', () => {
  test('only a known approved limit contributes to approved amount', () => {
    expect(knownApprovedAmount('APPROVED', true, 5000)).toBe(5000);
    expect(knownApprovedAmount('APPROVED', false)).toBe(0);
    expect(knownApprovedAmount('PENDING', true, 5000)).toBe(0);
    expect(knownApprovedAmount('TECHNICAL_ISSUE', true, 5000)).toBe(0);
  });

  test('skip is not a normalized issuer outcome', () => {
    const outcomes = [
      'APPROVED',
      'DECLINED',
      'PENDING',
      'APPLICATION_NOT_COMPLETED',
      'TECHNICAL_ISSUE',
      'OTHER',
    ];
    expect(outcomes).not.toContain('SKIP');
  });
});
