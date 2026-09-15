const prefix = 'astra:plan-authoring:v1:';
export const planRecoveryKey = (actorId: string, clientId: string, planId?: string) =>
  `${prefix}${encodeURIComponent(actorId)}:${encodeURIComponent(clientId)}${planId ? `:${encodeURIComponent(planId)}` : ''}`;
export function clearPlanTabRecovery() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (
        key.startsWith(prefix) ||
        key.startsWith('astra:plan-review-notes:v1:') ||
        key.startsWith('astra:goal-save:v1:')
      )
        sessionStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable; no copy can be read through this API. */
  }
}
