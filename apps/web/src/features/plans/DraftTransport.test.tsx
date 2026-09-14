import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import { SavedPlanResponse } from './SavedPlanResponse';

afterEach(() => vi.unstubAllGlobals());
test.each(['network', 'server'] as const)(
  'a sustained %s failure preserves edits and recovers through the real API wrapper',
  async (failure) => {
    const saved = {
      active: true,
      contextVersion: '2026-09-10T00:00:00Z',
      draft: {
        id: 'draft',
        itemId: 'step',
        revision: 1,
        values: {},
        note: 'Original note',
        help: false,
        files: [],
        unavailableFiles: 0,
        updatedAt: '2026-09-10T00:00:00Z',
      },
    };
    let unavailable = false;
    const fetcher = vi.fn().mockImplementation(async () => {
      if (unavailable) {
        if (failure === 'network') throw new TypeError('Network unavailable');
        return new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), {
          status: 503,
        });
      }
      return new Response(JSON.stringify(saved), { status: 200 });
    });
    vi.stubGlobal('fetch', fetcher);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={client}>
          <SavedPlanResponse
            item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }}
          />
        </QueryClientProvider>
      </ThemeProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
    const input = screen.getByRole('textbox', { name: 'Optional note for your consultant' });
    fireEvent.change(input, { target: { value: 'Retain my local edit' } });
    unavailable = true;
    void client
      .invalidateQueries({ queryKey: ['plan-response-draft', 'step'] })
      .catch(() => undefined);
    const retry = await screen.findByRole('button', { name: 'Retry draft lookup' });
    expect(input).toHaveValue('Retain my local edit');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    unavailable = false;
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry draft lookup' })).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue('Retain my local edit');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
  },
);
