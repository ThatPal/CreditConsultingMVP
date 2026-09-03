import { describe, expect, test, vi } from 'vitest';
import { assertSessionParticipant, sessionSnapshot } from './sessions.js';

describe('live session authorization and presence projection', () => {
  test('denies cross-client and wrong-consultant access', async () => {
    const prisma = {
      applicationSession: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'session', clientId: 'client-a', consultantId: 'staff-a' }),
      },
    } as never;
    await expect(
      assertSessionParticipant(prisma, 'session', {
        userId: 'client-user',
        clientId: 'client-b',
        role: 'CLIENT',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      assertSessionParticipant(prisma, 'session', { userId: 'staff-b', role: 'CONSULTANT' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('multi-tab leases keep supervision safe while one tab remains active', async () => {
    const prisma = {
      applicationSession: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 'session',
            roundId: 'round',
            appointmentId: 'appointment',
            strategyVersionId: 'strategy',
            status: 'LIVE',
            pauseReason: null,
            version: 3,
            startedAt: new Date(),
            endedAt: null,
          }),
      },
      sessionMessage: { findMany: vi.fn().mockResolvedValue([]) },
      sessionPresenceLease: {
        groupBy: vi.fn().mockResolvedValue([
          { role: 'CLIENT', _count: 1 },
          { role: 'CONSULTANT', _count: 2 },
        ]),
      },
    } as never;
    const value = await sessionSnapshot(prisma, 'session');
    expect(value.presence).toEqual({
      clientPresent: true,
      consultantPresent: true,
      supervisionSafe: true,
    });
    expect(value.session).not.toHaveProperty('sourceFingerprint');
    expect(value.session).not.toHaveProperty('coordinationVersion');
  });
});
