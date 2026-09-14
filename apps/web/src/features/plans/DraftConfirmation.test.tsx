import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SavedPlanResponse } from './SavedPlanResponse';
import { theme } from '../../theme';
import { bindRequestActor } from '../../auth/requestActor';
afterEach(() => {
  vi.unstubAllGlobals();
  bindRequestActor('u');
});

test.each(['network', 'server'] as const)(
  'an accepted save survives a %s confirmation failure without a repeated write',
  async (failure) => {
    let revision = 1;
    let reads = 0;
    let writes = 0;
    let recovered = false;
    let releaseCheck!: () => void;
    const snapshot = () => ({
      active: true,
      contextVersion: 'context',
      draft: {
        id: 'draft',
        itemId: 'step',
        revision,
        note: revision === 1 ? 'Original' : 'Accepted answer',
        values: {},
        files: [],
        help: false,
        unavailableFiles: 0,
        updatedAt: '2026-09-14T00:00:00Z',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        if (init?.method === 'PUT') {
          writes++;
          revision++;
          return new Response(JSON.stringify(snapshot()));
        }
        reads++;
        if (reads === 2)
          await new Promise<void>((resolve) => {
            releaseCheck = resolve;
          });
        if (reads > 1 && !recovered) {
          if (failure === 'network') throw new TypeError('Connection lost');
          return new Response('{}', { status: 503 });
        }
        return new Response(JSON.stringify(snapshot()));
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
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
    fireEvent.change(input, { target: { value: 'Accepted answer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Your save was accepted. Checking the latest/);
    expect(screen.getByRole('button', { name: 'Save completed step' })).toBeDisabled();
    expect(input).toHaveValue('Accepted answer');
    await act(async () => {
      releaseCheck();
    });
    await screen.findByText(/Your last save was accepted, but/);
    expect(screen.queryByText(/A Plan update is waiting/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    recovered = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry draft lookup' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry draft lookup' })).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText('Draft saved privately. Your consultant has not received it.'),
    ).toBeInTheDocument();
    expect(writes).toBe(1);
    expect(input).toHaveValue('Accepted answer');
    expect(screen.getByRole('button', { name: 'Save completed step' })).toBeEnabled();
    view.unmount();
  },
);
