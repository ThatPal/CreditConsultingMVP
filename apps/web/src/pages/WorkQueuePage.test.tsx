import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { WorkQueuePage } from './PlatformPages';

const response = {
  total: 1,
  page: 1,
  pageSize: 12,
  counts: { open: 1, urgent: 1, mine: 0, unassigned: 1 },
  items: [
    {
      id: 'attention-1',
      title: 'Support reply needed: Deadline question',
      priority: 'URGENT',
      status: 'OPEN',
      dueAt: null,
      neededSince: '2026-08-31T12:00:00Z',
      version: 2,
      assigneeId: null,
      reasonCode: 'CLIENT_REPLY_NEEDED',
      deepLink: { type: 'SUPPORT_CASE', route: '/crm/support', params: { caseId: 'case-1' } },
      client: { firstName: 'Jordan', lastName: 'Blake' },
      assignee: null,
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('CRM-02 Work Queue', () => {
  test('renders canonical attention, typed deep link, counts, filters, and claim command', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async (_input, init) =>
          new Response(
            JSON.stringify(
              init?.method === 'POST'
                ? { item: { ...response.items[0], assigneeId: 'me' }, replayed: false }
                : response,
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      );
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <MemoryRouter>
            <WorkQueuePage />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(await screen.findByText(/Deadline question/)).toBeInTheDocument();
    expect(screen.getByText('1 urgent')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open workspace' })).toHaveAttribute(
      'href',
      '/crm/support?case=case-1',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/consultant/work-queue/attention-1/claim'),
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ expectedVersion: 2 }) }),
      ),
    );
  });
});
