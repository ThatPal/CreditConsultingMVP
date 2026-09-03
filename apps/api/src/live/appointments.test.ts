import { describe, expect, test } from 'vitest';
import { localSlotUtc, noOpCalendarProvider } from './appointments.js';

describe('appointment availability foundations', () => {
  test('converts local slots deterministically across DST boundaries', () => {
    expect(
      localSlotUtc(new Date('2026-03-07T12:00:00Z'), 9 * 60, 'America/New_York').toISOString(),
    ).toBe('2026-03-07T14:00:00.000Z');
    expect(
      localSlotUtc(new Date('2026-03-09T12:00:00Z'), 9 * 60, 'America/New_York').toISOString(),
    ).toBe('2026-03-09T13:00:00.000Z');
  });

  test('keeps the deterministic fallback honest and private', async () => {
    expect(noOpCalendarProvider.configured).toBe(false);
    expect(await noOpCalendarProvider.busy('consultant', new Date(), new Date())).toEqual([]);
    expect(await noOpCalendarProvider.mirror('appointment')).toEqual({});
  });
});
