import { describe, expect, test, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { governedSwitchEnabled, requireGovernedSwitch } from './settings.js';
const prisma = (value: unknown) =>
  ({
    platformSettingVersion: { findFirst: vi.fn().mockResolvedValue(value) },
  }) as unknown as PrismaClient;
describe('governed safety switches', () => {
  test('defaults enabled when no governed override exists', async () =>
    expect(governedSwitchEnabled(prisma(null), 'ai.processing.enabled')).resolves.toBe(true));
  test('blocks when the active typed version is false', async () => {
    const db = prisma({ value: false });
    await expect(requireGovernedSwitch(db, 'commerce.purchases.enabled')).rejects.toMatchObject({
      code: 'FEATURE_TEMPORARILY_DISABLED',
      status: 503,
    });
  });
  test('does not treat non-boolean values as a disable instruction', async () =>
    expect(
      governedSwitchEnabled(prisma({ value: 'false' }), 'workflow.execution.enabled'),
    ).resolves.toBe(false));
});
