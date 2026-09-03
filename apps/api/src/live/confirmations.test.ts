import { describe, expect, test, vi } from 'vitest';
import { assertCurrentPreLiveConfirmation } from './confirmations.js';

const state = (confirmationFingerprint = 'fingerprint', roundFingerprint = 'fingerprint') =>
  ({
    applicationSession: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'session',
        roundId: 'round',
        strategyVersionId: 'strategy',
        sourceFingerprint: 'fingerprint',
      }),
    },
    preLiveMaterialChangeConfirmation: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: 'confirmation', sourceFingerprint: confirmationFingerprint }),
    },
    creditCardRound: {
      findUnique: vi.fn().mockResolvedValue({ sourceFingerprint: roundFingerprint }),
    },
  }) as never;

describe('pre-live release gate', () => {
  test('accepts only a current exact-source confirmation', async () => {
    await expect(assertCurrentPreLiveConfirmation(state(), 'session')).resolves.toMatchObject({
      id: 'confirmation',
    });
  });

  test('fails closed when a canonical material event changes the source fingerprint', async () => {
    await expect(
      assertCurrentPreLiveConfirmation(state('fingerprint', 'new-fingerprint'), 'session'),
    ).rejects.toMatchObject({ code: 'PRELIVE_CONFIRMATION_STALE' });
  });

  test('does not accept a confirmation for a different frozen source', async () => {
    await expect(
      assertCurrentPreLiveConfirmation(state('older-fingerprint'), 'session'),
    ).rejects.toMatchObject({ code: 'PRELIVE_CONFIRMATION_REQUIRED' });
  });
});
