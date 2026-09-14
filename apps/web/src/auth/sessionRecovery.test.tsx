import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { apiRequest, type CurrentUser } from './api';
import { AuthProvider, useAuth } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '../pages/AuthPages';

const clientUser: CurrentUser = {
  userId: 'client-user',
  clientId: 'client-record',
  email: 'client@example.test',
  role: 'CLIENT',
  status: 'ACTIVE',
};

function LocationProbe() {
  const location = useLocation();
  const expired = (location.state as { sessionExpired?: boolean } | null)?.sessionExpired;
  return (
    <div data-testid="location" data-expired={String(expired === true)}>
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
  test('real authentication refresh returns to the Plan after an expired request and sign-in', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = String(input);
      const expired = path.endsWith('/expire-proof');
      return new Response(JSON.stringify(path.endsWith('/api/me') ? { user: clientUser } : {}), {
        status: expired ? 401 : 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/app/plan?step=review#response']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute roles={['CLIENT']} />}>
                <Route
                  path="/app/plan"
                  element={
                    <>
                      <LocationProbe />
                      <button
                        onClick={() => {
                          void apiRequest('/expire-proof').catch(() => undefined);
                        }}
                      >
                        Expire session
                      </button>
                    </>
                  }
                />
                <Route path="/app" element={<div>Unexpected home redirect</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Expire session' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session ended');
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: clientUser.email } });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'synthetic-password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);
    expect(await screen.findByTestId('location')).toHaveTextContent(
      '/app/plan?step=review#response',
    );
    expect(screen.queryByText('Unexpected home redirect')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('authoritative 401 clears protected state and preserves the exact internal return path', async () => {
    sessionStorage.setItem('astra:plan-authoring:v1:proof', 'private notes');
    sessionStorage.setItem('astra:plan-review-notes:v1:proof', 'private review');
    const queryClient = renderProtected('/app/services/active?view=credits#ledger', 401);
    expect(
      await screen.findByText('/login|/app/services/active?view=credits#ledger', undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(['another-protected-client-record'])).toBeUndefined();
    expect(queryClient.getQueryData(['public-proof'])).toEqual({ harmless: true });
    expect(screen.getByTestId('location')).toHaveAttribute('data-expired', 'true');
    expect(sessionStorage.getItem('astra:plan-authoring:v1:proof')).toBeNull();
    expect(sessionStorage.getItem('astra:plan-review-notes:v1:proof')).toBeNull();
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

function LogoutProbe() {
  const { user, logout } = useAuth();
  return (
    <>
      <div>{user ? 'Session active' : 'Session cleared'}</div>
      <button
        onClick={() => {
          void logout().catch(() => undefined);
        }}
      >
        Sign out test
      </button>
    </>
  );
}

test.each([200, 503])(
  'sign-out status %s broadcasts only after server confirmation',
  async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status }));
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const client = new QueryClient();
    client.setQueryData(['private-record'], { private: true });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider initialUser={clientUser}>
          <LogoutProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign out test' }));
    if (status === 200) {
      expect(await screen.findByText('Session cleared')).toBeInTheDocument();
      expect(client.getQueryData(['private-record'])).toBeUndefined();
      expect(storageWrite).toHaveBeenCalledWith(
        'astra:session-ended:v1',
        expect.stringMatching(/^[0-9a-f-]{36}$/i),
      );
    } else {
      await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
      expect(screen.getByText('Session active')).toBeInTheDocument();
      expect(client.getQueryData(['private-record'])).toEqual({ private: true });
      expect(storageWrite).not.toHaveBeenCalled();
    }
  },
);

test.each([
  { userId: 'different-user' },
  { clientId: 'different-client' },
  { role: 'ADMIN' as const },
  { status: 'DISABLED' as const },
])('changed session identity or authority clears old private state: %j', async (change) => {
  const replacement = { ...clientUser, ...change };
  const fetcher = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ user: clientUser }), { status: 200 }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['private-record'], { note: 'Previous account answer' });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/app/plan']}>
          <Routes>
            <Route path="/login" element={<div>Identity reauthentication required</div>} />
            <Route element={<ProtectedRoute roles={['CLIENT', 'ADMIN']} />}>
              <Route path="/app/plan" element={<LogoutProbe />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Session active')).toBeInTheDocument();
  fetcher.mockResolvedValue(new Response(JSON.stringify({ user: replacement }), { status: 200 }));
  await client.invalidateQueries({ queryKey: ['current-user'] });
  expect(await screen.findByText('Identity reauthentication required')).toBeInTheDocument();
  expect(client.getQueryData(['private-record'])).toBeUndefined();
});
