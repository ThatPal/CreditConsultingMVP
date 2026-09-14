import { afterEach, expect, test, vi } from 'vitest';
import { connectSessionTabs } from './sessionTabs';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
});

test('broadcasts only an event name and releases the channel listener', () => {
  const postMessage = vi.fn(),
    close = vi.fn();
  const instance = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage,
    close,
  };
  vi.stubGlobal(
    'BroadcastChannel',
    vi.fn(function () {
      return instance;
    }),
  );
  const receive = vi.fn();
  const connection = connectSessionTabs(receive);
  connection.publish();
  expect(postMessage).toHaveBeenCalledWith('session-ended');
  expect(localStorage.length).toBe(0);
  instance.onmessage?.(new MessageEvent('message', { data: 'unrelated' }));
  expect(receive).not.toHaveBeenCalled();
  instance.onmessage?.(new MessageEvent('message', { data: 'session-ended' }));
  expect(receive).toHaveBeenCalledOnce();
  connection.close();
  expect(close).toHaveBeenCalledOnce();
  expect(instance.onmessage).toBeNull();
});

test('storage fallback ignores unrelated and removed values and stops after cleanup', () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  const receive = vi.fn();
  const connection = connectSessionTabs(receive);
  for (const [key, newValue] of [
    ['other', crypto.randomUUID()],
    ['astra:session-ended:v1', null],
    ['astra:session-ended:v1', 'invalid'],
  ]) {
    window.dispatchEvent(new StorageEvent('storage', { key: key!, newValue: newValue ?? null }));
  }
  expect(receive).not.toHaveBeenCalled();
  const event = new StorageEvent('storage', {
    key: 'astra:session-ended:v1',
    newValue: crypto.randomUUID(),
  });
  window.dispatchEvent(event);
  expect(receive).toHaveBeenCalledOnce();
  connection.close();
  window.dispatchEvent(event);
  expect(receive).toHaveBeenCalledOnce();
});

test('unavailable messaging and denied storage cannot fail local logout', () => {
  vi.stubGlobal('BroadcastChannel', undefined);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  const connection = connectSessionTabs(vi.fn());
  expect(() => connection.publish()).not.toThrow();
  connection.close();
});
