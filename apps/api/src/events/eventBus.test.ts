import { describe, expect, test, vi } from 'vitest';
import { InProcessDomainEventBus } from './eventBus.js';

describe('domain event boundary', () => {
  test('publishes a versioned browser-safe envelope and can unsubscribe', async () => {
    const bus = new InProcessDomainEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    const event = await bus.publish('client-a', ['review', 'review', 'credit-profile']);
    expect(event).toMatchObject({
      version: 1,
      type: 'resource.changed',
      clientId: 'client-a',
      domains: ['review', 'credit-profile'],
    });
    expect(event.id).toBeTruthy();
    expect(listener).toHaveBeenCalledWith(event);
    unsubscribe();
    await bus.publish('client-a', ['review']);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

test('preserves the private recipient through the in-process transport', async () => {
  const bus = new InProcessDomainEventBus();
  const receive = vi.fn();
  bus.subscribe(receive);
  await bus.publish('client', ['plan-drafts'], 'owner');
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ targetUserId: 'owner', domains: ['plan-drafts'] }),
  );
});
