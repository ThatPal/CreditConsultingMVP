import type { AuthPrincipal } from './types.js';
export function createLiveSessionGuard(
  initial: AuthPrincipal,
  resolve: () => Promise<AuthPrincipal | null>,
  onEnded: () => void,
  onUnavailable: () => void,
) {
  let stopped = false;
  let pending: Promise<boolean> | null = null;
  const check = () => {
    if (stopped) return Promise.resolve(false);
    if (pending) return pending;
    pending = (async () => {
      try {
        const current = await resolve();
        if (stopped) return false;
        if (
          !current ||
          current.userId !== initial.userId ||
          current.sessionId !== initial.sessionId ||
          current.role !== initial.role ||
          current.clientId !== initial.clientId ||
          current.status !== 'ACTIVE' ||
          (initial.role !== 'CLIENT' && !current.staffMfaVerified)
        ) {
          stopped = true;
          onEnded();
          return false;
        }
        return true;
      } catch {
        if (!stopped) {
          stopped = true;
          onUnavailable();
        }
        return false;
      } finally {
        pending = null;
      }
    })();
    return pending;
  };
  return {
    check,
    stop() {
      stopped = true;
    },
  };
}
