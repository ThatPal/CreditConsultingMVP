import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { LiveUpdates } from './LiveUpdates';
import { subscribeToSessionLoss } from './auth/sessionLoss';
import { bindRequestActor } from './auth/requestActor';
vi.mock('./auth/AuthProvider', () => ({
  useAuth: () => ({ user: { userId: 'u', clientId: 'c', role: 'CLIENT', status: 'ACTIVE' } }),
}));
class Source extends EventTarget {
  static current: Source;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  constructor() {
    super();
    Source.current = this;
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  bindRequestActor('u');
});
function setup() {
  vi.stubGlobal('EventSource', Source);
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LiveUpdates>
        <div>Workspace</div>
      </LiveUpdates>
    </QueryClientProvider>,
  );
}
test('session-ended closes the source and signals private-state cleanup', () => {
  const ended = vi.fn();
  const stop = subscribeToSessionLoss(ended);
  const view = setup();
  act(() => Source.current.dispatchEvent(new Event('session-ended')));
  expect(ended).toHaveBeenCalledOnce();
  expect(Source.current.close).toHaveBeenCalled();
  view.unmount();
  stop();
});
test.each([401, 503])(
  'reconnect status %s distinguishes expiry from a transient failure',
  async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status }));
    const ended = vi.fn();
    const stop = subscribeToSessionLoss(ended);
    const view = setup();
    await act(async () => Source.current.onerror?.());
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(ended).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    view.unmount();
    stop();
  },
);
