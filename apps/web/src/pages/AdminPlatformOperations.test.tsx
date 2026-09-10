import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { AdminIntegrationsPage } from './AdminIntegrationsPage';
import { AdminScheduledJobsPage } from './AdminScheduledJobsPage';
import { SystemHealthPage } from './ShellPages';

vi.mock('../auth/api', async () => {
  const actual = await vi.importActual<typeof import('../auth/api')>('../auth/api');
  return { ...actual, apiRequest: vi.fn() };
});

function renderPage(page: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{page}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe('POAR D7 platform operations foundation', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  test('uses a bounded integration registry and explains configured versus future effective work', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      integrations: [
        {
          id: 'integration-1',
          key: 'mail.primary',
          type: 'EMAIL',
          provider: 'Mail Provider',
          enabled: true,
          status: 'DEGRADED',
          configurationMetadata: {},
          secretConfiguration: { configured: true, count: 1 },
          lastTestedAt: null,
          lastSuccessAt: '2026-09-10T12:00:00.000Z',
          lastErrorCategory: 'TIMEOUT',
          updatedAt: '2026-09-10T12:00:00.000Z',
        },
      ],
    });
    const { container } = renderPage(<AdminIntegrationsPage />);
    expect(await screen.findByText('Mail Provider · EMAIL')).toBeInTheDocument();
    expect(container.querySelector('[data-collection-mode="bounded"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    expect(screen.getByText('Effective timing')).toBeInTheDocument();
    expect(
      screen.getByText(/queued and running work keep their recorded provider contract/i),
    ).toBeInTheDocument();
  });

  test('presents durable scheduler state as a keyboard-navigable operations collection', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      definitions: [
        {
          id: 'job-1',
          key: 'notification.retry',
          taskType: 'NOTIFICATION_RETRY',
          schedule: 'Every 5 minutes',
          enabled: true,
          maxRuntimeSec: 60,
          runs: [
            {
              id: 'run-1',
              status: 'FAILED',
              createdAt: '2026-09-10T12:00:00.000Z',
              completedAt: '2026-09-10T12:00:10.000Z',
              failureCode: 'PROVIDER_TIMEOUT',
            },
          ],
        },
      ],
    });
    const { container } = renderPage(<AdminScheduledJobsPage />);
    expect(await screen.findByText('notification.retry')).toBeInTheDocument();
    expect(container.querySelector('[data-collection-item][tabindex="0"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Queue manual run' }));
    expect(screen.getByText(/worker starts work after it durably claims/i)).toBeInTheDocument();
  });

  test('renders an observability cockpit from factual current snapshots with owning remediation links', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      asOf: '2026-09-10T12:00:00.000Z',
      sections: {
        platform: {
          status: 'degraded',
          reason: 'Two durable events need review.',
          href: '/admin/system-health',
          pendingOutbox: 4,
          failedOutbox: 2,
        },
        ai: { status: 'healthy', href: '/admin/ai/jobs', queued: 3 },
      },
    });
    const { container } = renderPage(<SystemHealthPage />);
    expect(await screen.findByText('Durable delivery backlog')).toBeInTheDocument();
    expect(await screen.findByText('Two durable events need review.')).toBeInTheDocument();
    expect(screen.getByText(/Confirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/Stale/)).not.toBeInTheDocument();
    expect(container.querySelector('[data-archetype="observability-cockpit"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Open owning module' })).toHaveAttribute(
      'href',
      '/admin/ai/jobs',
    );
  });
});
