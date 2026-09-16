import { expect, test } from 'vitest';
import { workspaceRefreshAt } from './refresh.js';
const now = new Date('2026-09-16T12:00:00Z');
const appointment = {
  status: 'BOOKED',
  startsAt: new Date('2026-09-16T13:00:00Z'),
  endsAt: new Date('2026-09-16T14:00:00Z'),
};
test('selects the first future expiry or appointment boundary', () => {
  expect(workspaceRefreshAt(now, null, appointment)?.toISOString()).toBe(
    '2026-09-16T12:30:00.000Z',
  );
  expect(
    workspaceRefreshAt(now, new Date('2026-09-16T12:10:00Z'), appointment)?.toISOString(),
  ).toBe('2026-09-16T12:10:00.000Z');
  expect(workspaceRefreshAt(new Date('2026-09-16T12:30:00Z'), null, appointment)).toEqual(
    appointment.endsAt,
  );
  expect(workspaceRefreshAt(appointment.endsAt, null, appointment)).toBeNull();
});
test('ignores past, invalid and cancelled boundaries', () => {
  expect(
    workspaceRefreshAt(now, new Date('invalid'), { ...appointment, status: 'CANCELLED' }),
  ).toBeNull();
  expect(workspaceRefreshAt(now, now, null)).toBeNull();
});
