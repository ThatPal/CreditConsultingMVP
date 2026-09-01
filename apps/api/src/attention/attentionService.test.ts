import { describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  reconcileSupportAttention,
  attentionClaimDecision,
  supportAttentionDeepLink,
  supportNeedsAttention,
  workQueueOrderBy,
} from './attentionService.js';

const supportCase = {
  id: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  assignedToUserId: null,
  subject: 'Document review question',
  priority: 'HIGH' as const,
  status: 'WAITING_ON_SUPPORT' as const,
  lastMessageAt: new Date('2026-08-31T12:00:00Z'),
};

function fakeDb() {
  const rows: Array<Record<string, unknown>> = [];
  const workItem = {
    findFirst: async ({ where }: { where: { dedupeKey: string } }) =>
      rows.find(
        (row) =>
          row.dedupeKey === where.dedupeKey &&
          ['OPEN', 'IN_PROGRESS', 'WAITING'].includes(String(row.status)),
      ) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `item-${rows.length + 1}`, status: 'OPEN', version: 0, ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((candidate) => candidate.id === where.id)!;
      Object.assign(row, data, { version: Number(row.version) + 1 });
      return row;
    },
  };
  return { rows, db: { workItem } as unknown as PrismaClient };
}

describe('canonical Attention projection', () => {
  test('creates one active item for a condition and replay updates instead of duplicating', async () => {
    const { db, rows } = fakeDb();
    await reconcileSupportAttention(db, supportCase);
    await reconcileSupportAttention(db, supportCase);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceType: 'SUPPORT_CASE',
      reasonCode: 'CLIENT_REPLY_NEEDED',
      dedupeKey: `SUPPORT_CASE:${supportCase.id}:REPLY_NEEDED`,
    });
  });

  test('clears the active projection when the owning support state no longer needs attention', async () => {
    const { db, rows } = fakeDb();
    await reconcileSupportAttention(db, supportCase);
    await reconcileSupportAttention(db, { ...supportCase, status: 'WAITING_ON_CLIENT' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('COMPLETED');
    expect(rows[0]?.resolvedAt).toBeInstanceOf(Date);
  });

  test('uses typed deep links and deterministic queue ordering with id as final tie-breaker', () => {
    expect(supportAttentionDeepLink(supportCase.id)).toEqual({
      type: 'SUPPORT_CASE',
      route: '/crm/support',
      params: { caseId: supportCase.id },
    });
    expect(supportNeedsAttention('OPEN')).toBe(true);
    expect(supportNeedsAttention('RESOLVED')).toBe(false);
    expect(workQueueOrderBy().at(-1)).toEqual({ id: 'asc' });
  });

  test('makes same-user retries harmless and rejects stale or competing claims', () => {
    expect(attentionClaimDecision({ assigneeId: null, version: 3 }, 'consultant-a', 3)).toBe(
      'CLAIM',
    );
    expect(
      attentionClaimDecision({ assigneeId: 'consultant-a', version: 4 }, 'consultant-a', 3),
    ).toBe('REPLAY');
    expect(
      attentionClaimDecision({ assigneeId: 'consultant-b', version: 4 }, 'consultant-a', 4),
    ).toBe('STALE');
    expect(attentionClaimDecision({ assigneeId: null, version: 4 }, 'consultant-a', 3)).toBe(
      'STALE',
    );
  });
});
