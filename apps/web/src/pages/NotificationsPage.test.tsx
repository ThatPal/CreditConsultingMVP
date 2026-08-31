import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { NotificationsPage } from './NotificationsPage';

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NotificationsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PORTAL-41 notifications', () => {
  test('renders chronological safe notifications and marks an item read', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'PATCH') return json({ notification: { id: 'notification-1' } });
      return json({
        unread: 1,
        notifications: [
          {
            id: 'notification-1',
            type: 'ACCOUNT_UPDATED',
            category: 'OPERATIONAL',
            title: 'Account update',
            body: 'A safe account update is available.',
            link: null,
            readAt: null,
            createdAt: '2026-08-31T17:00:00.000Z',
          },
        ],
      });
    });
    renderPage();
    expect(await screen.findByText('Account update')).toBeInTheDocument();
    expect(screen.getByText('Unread')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Account update'));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/notification-1/read'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  test('renders empty and safe error states', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ unread: 0, notifications: [] }));
    const first = renderPage();
    expect(
      await screen.findByRole('heading', { name: /no notifications yet/i }),
    ).toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json({ error: { message: 'smtp password secret://private' } }, 500),
    );
    renderPage();
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/smtp password/i)).not.toBeInTheDocument();
  });
});
