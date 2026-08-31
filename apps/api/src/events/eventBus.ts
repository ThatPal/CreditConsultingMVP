import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { LiveEventDomain, LiveEventEnvelope } from '@credit/shared';

export type EventSubscription = (event: LiveEventEnvelope) => void;
export interface DomainEventBus {
  publish(clientId: string, domains: LiveEventDomain[]): Promise<LiveEventEnvelope>;
  subscribe(listener: EventSubscription): () => void;
}

export class InProcessDomainEventBus implements DomainEventBus {
  private readonly emitter = new EventEmitter().setMaxListeners(500);

  async publish(clientId: string, domains: LiveEventDomain[]) {
    const event: LiveEventEnvelope = {
      id: randomUUID(),
      version: 1,
      type: 'resource.changed',
      occurredAt: new Date().toISOString(),
      clientId,
      domains: [...new Set(domains)],
    };
    this.emitter.emit('event', event);
    return event;
  }

  subscribe(listener: EventSubscription) {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}

// Sprint 0.2 adapter. Production Redis/pub-sub replaces this instance without
// changing publishers, subscribers, or the browser-safe event envelope.
export const domainEventBus: DomainEventBus = new InProcessDomainEventBus();
