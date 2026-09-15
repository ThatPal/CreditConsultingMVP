export type GoalCommand = { path: string; method: string; body: string; key: string };
export type GoalRecovery = { phase: 'unknown' | 'accepted'; command: GoalCommand; savedAt: number };
export const goalRecoveryPrefix = 'astra:goal-save:v1:';
export const goalRecoveryKey = (actor: string, client: string, cycle: string | null) =>
  `${goalRecoveryPrefix}${encodeURIComponent(actor)}:${encodeURIComponent(client)}:${encodeURIComponent(cycle ?? '')}`;
export function readGoalRecovery(key: string): GoalRecovery | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw.length > 12000) return null;
    const record = JSON.parse(raw) as GoalRecovery;
    const c = record.command;
    if (
      !['unknown', 'accepted'].includes(record.phase) ||
      !Number.isFinite(record.savedAt) ||
      record.savedAt > Date.now() ||
      Date.now() - record.savedAt > 24 * 60 * 60 * 1000 ||
      !c ||
      typeof c.key !== 'string' ||
      c.key.length > 100 ||
      !c.key ||
      typeof c.body !== 'string' ||
      c.body.length > 8000 ||
      !(
        (c.method === 'POST' && c.path === '/api/v1/client/goals') ||
        (c.method === 'PATCH' && /^\/api\/v1\/client\/goals\/[a-zA-Z0-9-]+$/.test(c.path))
      )
    ) {
      sessionStorage.removeItem(key);
      return null;
    }
    const body = JSON.parse(c.body);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    return record;
  } catch {
    return null;
  }
}
export function writeGoalRecovery(key: string, record: GoalRecovery | null): boolean {
  try {
    if (record) sessionStorage.setItem(key, JSON.stringify(record));
    else sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
