import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { apiRequest, type CurrentUser } from './api';
import { AuthProvider, useAuth } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

const clientUser: CurrentUser = {
  userId: 'client-user',
  clientId: 'client-record',
  email: 'client@example.test',
  role: 'CLIENT',
  status: 'ACTIVE',
};

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {`${location.pathname}${location.search}${location.hash}|${String((location.state as { from?: string } | null)?.from ?? '')}`}
    </div>
  );
}

function ProtectedRequest() {
  const query = useQuery({
    queryKey: ['protected-proof'],
    queryFn: () => apiRequest('/api/v1/protected-proof'),
    retry: false,
  });
  const { user } = useAuth();
  return <div>{query.isError ? 'request error' : `private ${user?.email}`}</div>;
}

function renderProtected(entry: string, status: number) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ error: { message: `status ${status}` } }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['another-protected-client-record'], { secret: true });
  queryClient.setQueryDefaults(['public-proof'], { meta: { public: true } });
  queryClient.setQueryData(['public-proof'], { harmless: true });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUser={clientUser}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/login" element={<LocationProbe />} />
            <Route element={<ProtectedRoute roles={['CLIENT']} />}>
              <Route path="/app/*" element={<ProtectedRequest />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

afterEach(() => vi.restoreAllMocks());

describe('expired authenticated session recovery', () => {
  test('authoritative 401 clears protected state and preserves the exact internal return path', async () => {
    const queryClient = renderProtected('/app/services/active?view=credits#ledger', 401);
    expect(
      await screen.findByText('/login|/app/services/active?view=credits#ledger', undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(['another-protected-client-record'])).toBeUndefined();
    expect(queryClient.getQueryData(['public-proof'])).toEqual({ harmless: true });
    expect(screen.queryByText(/request error/i)).not.toBeInTheDocument();
  });

  test('client home expiry retains /app as its return destination', async () => {
    renderProtected('/app', 401);
    expect(await screen.findByText('/login|/app')).toBeInTheDocument();
  });

  test.each([403, 500])('status %s does not clear the authenticated shell', async (status) => {
    const queryClient = renderProtected('/app/services', status);
    expect(await screen.findByText('request error')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(queryClient.getQueryData(['another-protected-client-record'])).toEqual({ secret: true });
  });

  test('an unauthenticated login 401 does not create an expiry redirect loop', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<div>login remains authoritative</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('login remains authoritative')).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledOnce());
    expect(screen.getByText('login remains authoritative')).toBeInTheDocument();
  });
});
