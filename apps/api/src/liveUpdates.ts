import type { LiveEventDomain, LiveEventEnvelope } from '@credit/shared';
import { domainEventBus } from './events/eventBus.js';

export type LiveUpdate = LiveEventEnvelope;

export function publishLiveUpdate(clientId: string, ...domains: LiveEventDomain[]) {
  void domainEventBus.publish(clientId, domains);
}

export function subscribeToLiveUpdates(listener: (update: LiveUpdate) => void) {
  return domainEventBus.subscribe(listener);
}

export function publishPrivateLiveUpdate(
  clientId: string,
  targetUserId: string,
  ...domains: LiveEventDomain[]
) {
  void domainEventBus.publish(clientId, domains, targetUserId);
}
