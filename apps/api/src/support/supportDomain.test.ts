import { describe, expect, test } from 'vitest';
import {
  routeSupportCase,
  SUPPORT_AUTHORITY_DENYLIST,
  supportContextLink,
  supportReplyTransition,
  supportTransitions,
} from './supportDomain.js';

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

describe('support completion contracts', () => {
  test('routes deterministically with relationship assignment and priority SLA', () => {
    const createdAt = new Date('2026-09-04T12:00:00.000Z');
    expect(routeSupportCase({ category: 'DOCUMENTS', priority: 'URGENT', createdAt, assignedConsultantId: 'consultant-1' })).toEqual({
      queue: 'DOCUMENTS', assigneeId: 'consultant-1', slaDueAt: new Date('2026-09-04T14:00:00.000Z'), reason: 'CLIENT_RELATIONSHIP',
    });
    expect(routeSupportCase({ category: 'OTHER', priority: 'NORMAL', createdAt })).toMatchObject({ queue: 'GENERAL', assigneeId: null, reason: 'QUEUE_FALLBACK' });
  });

  test('uses safe internal deep links and declares the immutable authority denylist', () => {
    expect(supportContextLink('APPLICATION_ROUND', 'round-1')).toBe('/app/rounds/round-1');
    expect(supportContextLink('DOCUMENT', 'document-1')).toBe('/app/documents');
    expect(SUPPORT_AUTHORITY_DENYLIST).toContain('strategy.mutate');
    expect(SUPPORT_AUTHORITY_DENYLIST).toContain('payment.mutate');
    expect(SUPPORT_AUTHORITY_DENYLIST).toContain('security.mutate');
  });
});
