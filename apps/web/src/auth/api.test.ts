import { afterEach, describe, expect, test, vi } from 'vitest';
import { apiBlobRequest, apiFileRequest, apiRequest, ApiRequestError } from './api';
import { subscribeToSessionLoss } from './sessionLoss';

afterEach(() => vi.restoreAllMocks());

describe('authenticated request session-loss signal', () => {
  test.each([
    ['json', () => apiRequest('/api/v1/protected')],
    ['blob', () => apiBlobRequest('/api/v1/documents/document-id/content')],
    ['file', () => apiFileRequest('/api/v1/documents', new File(['proof'], 'proof.txt'))],
  ])('%s requests share the canonical 401 signal', async (_kind, operation) => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionLoss(listener);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Authentication required' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(operation()).rejects.toBeInstanceOf(ApiRequestError);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  test.each([403, 500])('status %s is not classified as session loss', async (status) => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionLoss(listener);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Request failed' } }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await expect(apiRequest('/api/v1/protected')).rejects.toBeInstanceOf(ApiRequestError);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
