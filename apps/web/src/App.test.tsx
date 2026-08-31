import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App, isDesignSystemShowcaseEnabled } from './App';
import { designTokens, reducedMotionStyles } from './theme/designTokens';
import { AuthProvider } from './auth/AuthProvider';
import type { CurrentUser } from './auth/api';
import { theme } from './theme';
import { validateNavigationRegistry } from './layouts/navigation';

function renderAt(
  path: string,
  forcedRole?: 'CLIENT' | 'CONSULTANT' | 'ADMIN',
  overrides: Partial<CurrentUser> = {},
) {
  const role =
    forcedRole ??
    (path.startsWith('/crm') ? 'CONSULTANT' : path.startsWith('/admin') ? 'ADMIN' : 'CLIENT');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider
          initialUser={{
            userId: 'test-user',
            email: 'test@example.com',
            role,
            status: 'ACTIVE',
            clientId: role === 'CLIENT' ? 'test-client' : null,
            staffMfaEnabled: role !== 'CLIENT',
            staffMfaVerified: true,
            stepUpVerified: true,
            capabilities: role === 'CONSULTANT' ? ['client.read', 'support.manage'] : [],
            ...overrides,
          }}
        >
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('application shells', () => {
  test('client shell provides the approved navigation and excludes Reviews', () => {
    renderAt('/app');
    const navigation = screen.getByRole('navigation', { name: /client navigation/i });
    expect(within(navigation).getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Credit Center' })).toBeInTheDocument();
    expect(within(navigation).queryByText('Credit Plan')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('Reviews')).not.toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('consultant shell uses its distinct operational navigation', () => {
    renderAt('/crm');
    const navigation = screen.getByRole('navigation', { name: /consultant navigation/i });
    expect(within(navigation).getByRole('link', { name: 'Work Queue' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(within(navigation).queryByText('Goals')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /good morning/i })).toBeInTheDocument();
  });

  test('administrator lands in a distinct shell without consultant advisory navigation', () => {
    renderAt('/admin', 'ADMIN');
    const navigation = screen.getByRole('navigation', { name: /admin navigation/i });
    expect(screen.getByRole('heading', { name: /administration foundation/i })).toBeInTheDocument();
    expect(within(navigation).queryByText('Clients')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('Work Queue')).not.toBeInTheDocument();
  });

  test('credit readiness exposes prepared consultant decisions', () => {
    renderAt('/crm/readiness');
    expect(screen.getByRole('heading', { name: /credit readiness/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ready /i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /prepare — action needed/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /not ready — negative items/i }));
    expect(screen.getByRole('button', { name: /not ready — negative items/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('client overview presents the verified next action', () => {
    renderAt('/app');
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start guided update/i })).toBeInTheDocument();
  });

  test('mobile navigation opens and closes through accessible controls', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    });
    renderAt('/app');
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
    expect(screen.getByRole('navigation', { name: /client navigation/i })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    window.matchMedia = original;
  });

  test('account menu is keyboard-operable and exposes account, security, and sign out', async () => {
    renderAt('/app');
    const trigger = screen.getByRole('button', { name: /account profile/i });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: /account menu/i });
    expect(within(menu).getByRole('menuitem', { name: 'Account' })).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', { name: /security & sessions/i }),
    ).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
    fireEvent.keyDown(within(menu).getByRole('menuitem', { name: 'Account' }), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test('design system renders FocusSurface examples and semantic states', async () => {
    renderAt('/dev/design-system');
    expect(
      await screen.findByRole('heading', { name: /dark is the environment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Credit Profile summary')).toBeInTheDocument();
    expect(screen.getByText('Wizard confirmation')).toBeInTheDocument();
    expect(screen.getByText('Positive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open drawer/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/include utilization alerts/i)).toBeChecked();
    expect(screen.getByText(/blocked: consultant approval/i)).toBeInTheDocument();
  });

  test('exports canonical design tokens and reduced-motion behavior', () => {
    expect(designTokens.color.focusSurface).not.toBe('#ffffff');
    expect(designTokens.spacing.md).toBe(16);
    expect(designTokens.focus.width).toBeGreaterThanOrEqual(2);
    expect(reducedMotionStyles).toHaveProperty('@media (prefers-reduced-motion: reduce)');
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<string, unknown>;
    expect(baseline).toHaveProperty('*:focus-visible');
    expect(JSON.stringify(baseline['*:focus-visible'])).toContain('!important');
  });

  test('enables the showcase in the test environment without adding navigation', () => {
    expect(isDesignSystemShowcaseEnabled).toBe(true);
    renderAt('/app');
    expect(screen.queryByRole('link', { name: /design system/i })).not.toBeInTheDocument();
  });

  test('direct role-inappropriate routes redirect without rendering protected content', () => {
    renderAt('/admin', 'CLIENT');
    expect(screen.queryByText('Administration foundation')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  test('consultant cannot render the admin shell', () => {
    renderAt('/admin', 'CONSULTANT');
    expect(screen.queryByRole('navigation', { name: /admin navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /good morning/i })).toBeInTheDocument();
  });

  test('staff without current MFA assurance is directed to AUTH-05', () => {
    renderAt('/crm', 'CONSULTANT', { staffMfaVerified: false });
    expect(
      screen.getByRole('heading', { name: /protect your staff account/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: /consultant navigation/i }),
    ).not.toBeInTheDocument();
  });

  test('navigation projection hides capabilities the server did not grant', () => {
    renderAt('/crm', 'CONSULTANT', { capabilities: ['client.read'] });
    const navigation = screen.getByRole('navigation', { name: /consultant navigation/i });
    expect(within(navigation).getByRole('link', { name: 'Clients' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Support' })).not.toBeInTheDocument();
  });

  test('the typed navigation registry passes its fail-closed uniqueness and namespace checks', () => {
    expect(validateNavigationRegistry()).toBe(true);
  });

  test('security surface renders safe session metadata and revokes other sessions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/me/sessions'))
        return new Response(
          JSON.stringify({
            sessions: [
              {
                id: 'one',
                userAgent: 'Browser A',
                createdAt: '2026-08-31T00:00:00Z',
                updatedAt: '2026-08-31T00:00:00Z',
                expiresAt: '2026-09-01T00:00:00Z',
              },
              {
                id: 'two',
                userAgent: 'Browser B',
                createdAt: '2026-08-31T00:00:00Z',
                updatedAt: '2026-08-31T00:00:00Z',
                expiresAt: '2026-09-01T00:00:00Z',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      if (url.endsWith('/api/auth/revoke-other-sessions'))
        return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ notifications: [], unread: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    renderAt('/app/account/security');
    expect(await screen.findByText('Browser A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /revoke other sessions/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/revoke-other-sessions'),
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    fetchMock.mockRestore();
  });

  test('security surface shows a safe blocked state for a server 403', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/me/sessions'))
        return new Response(JSON.stringify({ error: { message: 'Forbidden' } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      return new Response(JSON.stringify({ notifications: [], unread: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    renderAt('/app/account/security');
    expect(
      await screen.findByText(/not authorized to view this security information/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Forbidden')).not.toBeInTheDocument();
    fetchMock.mockRestore();
  });
});
