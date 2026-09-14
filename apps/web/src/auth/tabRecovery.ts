const prefix = 'astra:plan-authoring:v1:';
export const planRecoveryKey = (actorId: string, clientId: string, planId?: string) =>
  `${prefix}${encodeURIComponent(actorId)}:${encodeURIComponent(clientId)}${planId ? `:${encodeURIComponent(planId)}` : ''}`;
export function clearPlanTabRecovery() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable; no copy can be read through this API. */
  }
}
