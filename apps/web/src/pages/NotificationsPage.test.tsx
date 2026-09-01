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
        hasMore: false,
        nextCursor: null,
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
    expect(await screen.findByRole('heading', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('New', { selector: '.MuiChip-label' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /account update/i }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notifications/notification-1/read'),
        expect.objectContaining({ method: 'PATCH' }),
      ),
    );
  });

  test('renders empty and safe error states', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json({ unread: 0, notifications: [], hasMore: false, nextCursor: null }));
    const first = renderPage();
    expect(
      await screen.findByRole('heading', { name: /all caught up/i }),
    ).toBeInTheDocument();
    first.unmount();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      json({ error: { message: 'smtp password secret://private' } }, 500),
    );
    renderPage();
    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/smtp password/i)).not.toBeInTheDocument();
  });
});
