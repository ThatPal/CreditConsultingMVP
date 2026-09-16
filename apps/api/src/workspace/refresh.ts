import { JOIN_WINDOW_MS } from '../live/timing.js';
// Read invalidation hint only. Commands and currentness remain server-authoritative.
export function workspaceRefreshAt(
  now: Date,
  expiresAt: Date | null | undefined,
  appointment: { status: string; startsAt: Date; endsAt: Date } | null,
) {
  const boundaries = [expiresAt?.getTime()];
  if (appointment?.status === 'BOOKED')
    boundaries.push(appointment.startsAt.getTime() - JOIN_WINDOW_MS, appointment.endsAt.getTime());
  const future = boundaries.filter(
    (time): time is number =>
      typeof time === 'number' && Number.isFinite(time) && time > now.getTime(),
  );
  return future.length ? new Date(Math.min(...future)) : null;
}
