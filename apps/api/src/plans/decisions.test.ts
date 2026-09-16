import { expect, test, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { getPlanDecisions } from './decisions.js';
test('queries both sources by client and selects only client-safe published content', async () => {
  const reviews = vi
    .fn()
    .mockResolvedValue([
      {
        id: 'review',
        reviewId: 'source',
        publishedAt: new Date('2026-01-01'),
        clientSafeProjection: {
          recommendation: { explanation: 'Published explanation' },
          internalRationale: 'private',
        },
      },
    ]);
  const decisions = vi
    .fn()
    .mockResolvedValue([
      {
        id: 'decision',
        caseId: 'case',
        version: 2,
        effectiveAt: new Date('2026-02-01'),
        supersededAt: null,
        clientSafeExplanation: 'Safe coordination',
        internalRationale: 'private',
      },
    ]);
  const result = await getPlanDecisions(
    {
      publishedCreditReview: { findMany: reviews },
      coordinationDecision: { findMany: decisions },
    } as unknown as PrismaClient,
    'client',
  );
  expect(reviews.mock.calls[0]![0].where).toEqual({ clientId: 'client' });
  expect(decisions.mock.calls[0]![0].where).toEqual({ case: { clientId: 'client' } });
  expect(decisions.mock.calls[0]![0].select).not.toHaveProperty('internalRationale');
  expect(result.map((x) => x.id)).toEqual(['decision', 'review']);
  expect(JSON.stringify(result)).not.toContain('private');
  expect(result[1]?.historical).toBe(true);
});
test('does not invent recommendation copy from malformed or absent publications', async () => {
  const result = await getPlanDecisions(
    {
      publishedCreditReview: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: 'bad', clientSafeProjection: { recommendation: { explanation: 3 } } },
          ]),
      },
      coordinationDecision: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient,
    'other',
  );
  expect(result).toEqual([]);
});
