import type { LiveEventEnvelope } from '@credit/shared';
import type { AuthPrincipal } from '../auth/types.js';

// Client subscription access alone never grants access to private draft activity.
export function matchesLiveAudience(principal: AuthPrincipal, event: LiveEventEnvelope) {
  if (event.targetUserId === undefined) return !event.domains.includes('plan-drafts');
  return (
    typeof event.targetUserId === 'string' &&
    event.targetUserId.length > 0 &&
    principal.role === 'CLIENT' &&
    principal.status === 'ACTIVE' &&
    principal.userId === event.targetUserId &&
    principal.clientId === event.clientId
  );
}
