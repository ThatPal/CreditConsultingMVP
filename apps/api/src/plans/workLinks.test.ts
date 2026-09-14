import { expect, test, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { resolvePlanWorkLinks } from './workLinks.js';
test('resolves legacy links in batches and never substitutes another client source or guessed default', async () => {
  const itemId = '11111111-1111-4111-8111-111111111111';
  const versionId = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    planItem: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: itemId,
            stableKey: 'follow up/one',
            planVersion: { planId: 'plan-a', plan: { clientId: 'a' } },
          },
        ]),
    },
    planVersion: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: versionId, planId: 'plan-b', plan: { clientId: 'b' } }]),
    },
  };
  const rows = [
    { clientId: 'a', sourceType: 'PlanItem', sourceId: itemId, deepLink: { route: '/wrong' } },
    { clientId: 'b', sourceType: 'PlanVersion', sourceId: versionId, deepLink: null },
    { clientId: 'b', sourceType: 'PlanItem', sourceId: itemId, deepLink: { route: '/unsafe' } },
    {
      clientId: 'a',
      sourceType: 'PlanItem',
      sourceId: 'legacy-invalid-id',
      deepLink: { route: '/default' },
    },
    {
      clientId: 'a',
      sourceType: 'SUPPORT_CASE',
      sourceId: 'case',
      deepLink: { route: '/crm/support' },
    },
  ];
  const result = await resolvePlanWorkLinks(prisma as unknown as PrismaClient, rows);
  expect(result[0]?.deepLink).toEqual({
    route: '/crm/clients/a/plan?planId=plan-a&stepKey=follow%20up%2Fone',
  });
  expect(result[1]?.deepLink).toEqual({ route: '/crm/clients/b/plan?planId=plan-b' });
  expect(result[2]?.deepLink).toBeNull();
  expect(result[3]?.deepLink).toBeNull();
  expect(result[4]).toBe(rows[4]);
  expect(prisma.planItem.findMany).toHaveBeenCalledOnce();
  expect(prisma.planVersion.findMany).toHaveBeenCalledOnce();
  expect(prisma.planItem.findMany.mock.calls[0]?.[0].where.id.in).toEqual([itemId]);
  expect(rows[0]?.deepLink).toEqual({ route: '/wrong' });
});
