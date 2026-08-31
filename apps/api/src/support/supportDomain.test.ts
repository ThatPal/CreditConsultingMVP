import { describe, expect, test } from 'vitest';
import { supportReplyTransition, supportTransitions } from './supportDomain.js';

describe('support reply lifecycle', () => {
  test('derives client and consultant visible reply states from the central transition map', () => {
    expect(supportReplyTransition('OPEN', 'CLIENT_VISIBLE_REPLY')).toBe('WAITING_ON_SUPPORT');
    expect(supportReplyTransition('WAITING_ON_CLIENT', 'CLIENT_VISIBLE_REPLY')).toBe(
      'WAITING_ON_SUPPORT',
    );
    expect(supportReplyTransition('OPEN', 'CONSULTANT_VISIBLE_REPLY')).toBe('WAITING_ON_CLIENT');
    expect(supportReplyTransition('WAITING_ON_SUPPORT', 'CONSULTANT_VISIBLE_REPLY')).toBe(
      'WAITING_ON_CLIENT',
    );
    expect(supportTransitions.OPEN).toContain('WAITING_ON_SUPPORT');
    expect(supportTransitions.OPEN).toContain('WAITING_ON_CLIENT');
  });

  test('requires explicit reopen from resolved and fails closed from closed', () => {
    expect(() => supportReplyTransition('RESOLVED', 'CLIENT_VISIBLE_REPLY')).toThrow(
      'SUPPORT_CASE_RESOLVED',
    );
    expect(() => supportReplyTransition('RESOLVED', 'CONSULTANT_VISIBLE_REPLY')).toThrow(
      'SUPPORT_CASE_RESOLVED',
    );
    expect(() => supportReplyTransition('CLOSED', 'CLIENT_VISIBLE_REPLY')).toThrow(
      'SUPPORT_CASE_CLOSED',
    );
  });
});
