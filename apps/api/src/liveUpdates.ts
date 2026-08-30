import { EventEmitter } from 'node:events';

export type LiveUpdate = { clientId: string; domains: string[]; at: string };
const events = new EventEmitter();
events.setMaxListeners(500);

export function publishLiveUpdate(clientId: string, ...domains: string[]) {
  events.emit('refresh', { clientId, domains, at: new Date().toISOString() } satisfies LiveUpdate);
}

export function subscribeToLiveUpdates(listener: (update: LiveUpdate) => void) {
  events.on('refresh', listener);
  return () => events.off('refresh', listener);
}
