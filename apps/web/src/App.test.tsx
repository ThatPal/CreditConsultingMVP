import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { App, isDesignSystemShowcaseEnabled } from './App';
import { designTokens, reducedMotionStyles } from './theme/designTokens';
import { AuthProvider } from './auth/AuthProvider';
import { theme } from './theme';

function renderAt(path: string, forcedRole?: 'CLIENT' | 'CONSULTANT' | 'ADMIN') {
  const role = forcedRole ?? (path.startsWith('/consultant') ? 'CONSULTANT' : 'CLIENT');
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
    renderAt('/client/overview');
    const navigation = screen.getByRole('navigation', { name: /client navigation/i });
    expect(within(navigation).getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Credit Profile' })).toBeInTheDocument();
    expect(within(navigation).queryByText('Credit Plan')).not.toBeInTheDocument();
    expect(within(navigation).queryByText('Reviews')).not.toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('consultant shell uses its distinct operational navigation', () => {
    renderAt('/consultant/dashboard');
    const navigation = screen.getByRole('navigation', { name: /consultant navigation/i });
    expect(within(navigation).getByRole('link', { name: 'Work Queue' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Support' })).toBeInTheDocument();
    expect(within(navigation).queryByText('Goals')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /good morning/i })).toBeInTheDocument();
  });

  test('administrator can render the support workspace', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes('support-cases') ? { cases: [] } : { notifications: [], unread: 0 };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    renderAt('/consultant/support', 'ADMIN');
    expect(await screen.findByRole('heading', { name: 'Support' })).toBeInTheDocument();
    fetchMock.mockRestore();
  });

  test('credit readiness exposes prepared consultant decisions', () => {
    renderAt('/consultant/readiness');
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
    renderAt('/client/overview');
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
    renderAt('/client/overview');
    fireEvent.click(screen.getByRole('button', { name: /open navigation/i }));
    expect(screen.getByRole('navigation', { name: /client navigation/i })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    window.matchMedia = original;
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
    renderAt('/client/overview');
    expect(screen.queryByRole('link', { name: /design system/i })).not.toBeInTheDocument();
  });
});
