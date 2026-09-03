import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { assertNoCreditActivityRestriction, restrictionScopes } from './service.js';

describe('Phase 15 global coordination restrictions', () => {
  it('defines every server-enforced card activity boundary', () => {
    expect(restrictionScopes).toEqual(['CYCLE', 'STRATEGY', 'SCHEDULING', 'LIVE_EXECUTION']);
  });

  it.each(restrictionScopes)('fails closed for an active %s restriction', async (scope) => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'restriction', scope, clearedAt: null });
    const prisma = { clientCreditActivityRestriction: { findFirst } } as unknown as PrismaClient;
    await expect(assertNoCreditActivityRestriction(prisma, 'client', scope)).rejects.toMatchObject({ code: 'CREDIT_ACTIVITY_RESTRICTED', status: 409 });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { clientId: 'client', scope, clearedAt: null } }));
  });

  it('permits the owning command only after the restriction is durably cleared', async () => {
    const prisma = { clientCreditActivityRestriction: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    await expect(assertNoCreditActivityRestriction(prisma, 'client', 'LIVE_EXECUTION')).resolves.toBeUndefined();
  });
});
