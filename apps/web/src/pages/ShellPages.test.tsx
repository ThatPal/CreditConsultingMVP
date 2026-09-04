import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { AdminLandingPage } from './ShellPages';

vi.mock('../auth/api', async () => {
  const actual = await vi.importActual<typeof import('../auth/api')>('../auth/api');
  return { ...actual, apiRequest: vi.fn() };
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AdminLandingPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('ADMIN-01 operational dashboard', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  test('renders canonical module status and owning deep links', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      asOf: new Date().toISOString(),
      sections: {
        commerce: { status: 'healthy', href: '/admin/payments', pending: 2 },
        ai: { status: 'healthy', href: '/admin/ai/jobs', queued: 3 },
        catalog: { status: 'healthy', href: '/admin/card-catalog', conflicts: 1 },
        integrations: { status: 'degraded', href: '/admin/integrations', unhealthy: 1 },
        security: { status: 'healthy', href: '/admin/security-events', recent: 0 },
        products: { status: 'healthy', href: '/admin/services', active: 4 },
        platform: { status: 'healthy', href: '/admin/system-health', failedOutbox: 0 },
        scheduledJobs: {
          status: 'unavailable',
          href: '/admin/scheduled-jobs',
          reason: 'Scheduled-job operations are not configured yet.',
        },
      },
    });
    renderPage();
    expect(await screen.findByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('AI runtime')).toBeInTheDocument();
    expect(screen.getByText('This module is partially degraded.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open module' })[0]).toHaveAttribute(
      'href',
      '/admin/payments',
    );
  });

});
