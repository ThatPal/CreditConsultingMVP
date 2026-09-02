import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, test, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';

function Location() {
  const location = useLocation();
  return (
    <div>
      {location.pathname}
      {location.search}
      {String((location.state as { from?: string } | null)?.from ?? '')}
    </div>
  );
}

describe('ProtectedRoute authentication routing', () => {
  test('routes a confirmed logged-out protected request to login with its internal return path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Authentication required' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider>
          <MemoryRouter initialEntries={['/app/documents?status=AVAILABLE']}>
            <Routes>
              <Route path="/login" element={<Location />} />
              <Route element={<ProtectedRoute roles={['CLIENT']} />}>
                <Route path="/app/documents" element={<div>private</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('/login/app/documents?status=AVAILABLE')).toBeInTheDocument();
    expect(screen.queryByText(/secure workspace/i)).not.toBeInTheDocument();
  });

  test('keeps a genuine workspace failure distinct from logged-out state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Unavailable' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider>
          <MemoryRouter initialEntries={['/app']}>
            <Routes>
              <Route path="/login" element={<div>login</div>} />
              <Route element={<ProtectedRoute roles={['CLIENT']} />}>
                <Route path="/app" element={<div>private</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/couldn’t load your secure workspace/i)).toBeInTheDocument();
    expect(screen.queryByText('login')).not.toBeInTheDocument();
  });

  test('falls back to the signed-in role home instead of exposing another role route', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider
          initialUser={{
            userId: 'consultant',
            clientId: null,
            email: 'consultant@example.test',
            role: 'CONSULTANT',
            status: 'ACTIVE',
            staffMfaVerified: true,
          }}
        >
          <MemoryRouter initialEntries={['/admin/services']}>
            <Routes>
              <Route path="/crm" element={<div>consultant home</div>} />
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/admin/services" element={<div>admin services</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('consultant home')).toBeInTheDocument();
    expect(screen.queryByText('admin services')).not.toBeInTheDocument();
  });

  test('routes enrolled staff to challenge without losing the requested app path', async () => {
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider
          initialUser={{
            userId: 'admin',
            clientId: null,
            email: 'admin@example.test',
            role: 'ADMIN',
            status: 'ACTIVE',
            staffMfaEnabled: true,
            staffMfaVerified: false,
          }}
        >
          <MemoryRouter initialEntries={['/admin/payments?status=FAILED']}>
            <Routes>
              <Route path="/mfa" element={<Location />} />
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="/admin/payments" element={<div>payments</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(
        '/mfa?mode=challenge&returnTo=%2Fadmin%2Fpayments%3Fstatus%3DFAILED',
      ),
    ).toBeInTheDocument();
  });
});
