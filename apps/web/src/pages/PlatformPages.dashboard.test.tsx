import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { ConsultantDashboardPage } from './PlatformPages';

vi.mock('../auth/api', async () => {
  const actual = await vi.importActual<typeof import('../auth/api')>('../auth/api');
  return { ...actual, apiRequest: vi.fn() };
});

describe('CRM-01 dashboard composition', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  test('renders canonical workload metrics while keeping Work Queue as action owner', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      metrics: { open: 12, dueToday: 3, activeClients: 25, reviews: 4, readiness: 2 },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <ConsultantDashboardPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText(/Work Queue remains the authoritative action source/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open' })[0]).toHaveAttribute(
      'href',
      '/crm/work-queue',
    );
  });
});
