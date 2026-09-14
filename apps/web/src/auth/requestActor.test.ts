import { afterEach, expect, test, vi } from 'vitest';
import { apiBlobRequest, apiFileRequest, apiRequest } from './api';
import { bindRequestActor, endRequestSession } from './requestActor';
import { subscribeToSessionLoss } from './sessionLoss';
afterEach(() => {
  vi.restoreAllMocks();
  bindRequestActor('test');
});
test('JSON, upload and download requests carry the established actor', async () => {
  bindRequestActor('expected-account');
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response('{}', { status: 200 }));
  await apiRequest('/api/v1/client/plan', { method: 'POST' });
  await apiFileRequest('/api/v1/documents', new File(['proof'], 'proof.pdf'));
  await apiBlobRequest('/api/v1/documents/file/content');
  for (const [, init] of fetcher.mock.calls)
    expect(new Headers(init?.headers).get('X-Credit-Actor')).toBe('expected-account');
});
test('an account mismatch ends local work and blocks follow-up private requests', async () => {
  bindRequestActor('old-account');
  const lost = vi.fn();
  const stop = subscribeToSessionLoss(lost);
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'SESSION_ACTOR_CHANGED', message: 'Account changed' } }),
        { status: 409 },
      ),
    );
  await expect(apiRequest('/api/v1/client/plan')).rejects.toThrow('Account changed');
  expect(lost).toHaveBeenCalledOnce();
  await expect(apiRequest('/api/v1/client/plan', { method: 'POST' })).rejects.toThrow(
    'Sign in again',
  );
  expect(fetcher).toHaveBeenCalledOnce();
  stop();
});
test('authentication and public intake remain available after session loss', async () => {
  endRequestSession();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
  await apiRequest('/api/auth/sign-in/email', { method: 'POST' });
  await apiRequest('/api/me');
  await apiRequest('/api/v1/goal-intakes', { method: 'POST' });
  expect(fetcher).toHaveBeenCalledTimes(3);
  for (const [, init] of fetcher.mock.calls)
    expect(new Headers(init?.headers).has('X-Credit-Actor')).toBe(false);
});

test('legacy protected routes carry the actor and stop after loss', async () => {
  bindRequestActor('legacy-account');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
  for (const path of ['/api/services', '/api/goals?view=active', '/api/application-cycles']) {
    await apiRequest(path);
  }
  for (const [, init] of fetcher.mock.calls)
    expect(new Headers(init?.headers).get('X-Credit-Actor')).toBe('legacy-account');
  endRequestSession();
  await expect(apiRequest('/api/goals', { method: 'POST' })).rejects.toThrow('Sign in again');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
