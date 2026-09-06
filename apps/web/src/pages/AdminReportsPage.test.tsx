import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { AdminReportsPage } from './AdminReportsPage';

vi.mock('../auth/api', async () => {
  const actual = await vi.importActual<typeof import('../auth/api')>('../auth/api');
  return { ...actual, apiRequest: vi.fn() };
});

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <AdminReportsPage />
      </QueryClientProvider>
    </ThemeProvider>,
  );
};

describe('Admin operational reports', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  test('renders understandable aggregate cards and rows instead of raw JSON', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      sections: {
        payments: [
          { state: 'SUCCEEDED', _count: 12, accessToken: 'must-never-render' },
          { state: 'FAILED', _count: 2 },
        ],
      },
    });

    const { container } = renderPage();
    expect(await screen.findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('2 status groups')).toBeInTheDocument();
    expect(screen.queryByText('must-never-render')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).toBeNull();
  });
});
