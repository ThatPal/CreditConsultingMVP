import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import { SavedPlanResponse } from './SavedPlanResponse';
import { bindRequestActor } from '../../auth/requestActor';
const snapshot = (revision: number, note: string) => ({
  active: true,
  contextVersion: 'context',
  draft: {
    id: 'draft',
    itemId: 'step',
    revision,
    note,
    values: {},
    help: false,
    files: [],
    unavailableFiles: 0,
    updatedAt: '2026-09-14T00:00:00Z',
  },
});
const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
afterEach(() => {
  vi.unstubAllGlobals();
  bindRequestActor('u');
});

test.each(['newer revision', 'discarded draft', 'recreated draft'] as const)(
  'a delayed save acknowledgment does not hide a %s',
  async (kind) => {
    let resolveSave!: (value: Response) => void;
    const accepted = snapshot(2, 'My saved note');
    const newer =
      kind === 'discarded draft'
        ? { ...snapshot(3, ''), draft: null }
        : kind === 'recreated draft'
          ? {
              ...snapshot(1, 'Recreated elsewhere'),
              draft: { ...snapshot(1, 'Recreated elsewhere').draft, id: 'new-draft' },
            }
          : snapshot(3, 'Newer saved elsewhere');
    let server: unknown = snapshot(1, 'Original');
    const fetcher = vi.fn(async (_url, init) =>
      init?.method === 'PUT'
        ? new Promise<Response>((resolve) => {
            resolveSave = resolve;
          })
        : response(server),
    );
    vi.stubGlobal('fetch', fetcher);
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
    fireEvent.change(input, { target: { value: 'My saved note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
    server = newer;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['plan-response-draft', 'step'] });
    });
    await act(async () => {
      resolveSave(response(accepted));
    });
    await waitFor(() =>
      expect(client.getQueryData(['plan-response-draft', 'step'])).toEqual(newer),
    );
    expect(
      await screen.findByRole('button', { name: 'Review saved response update' }),
    ).toBeEnabled();
    expect(input).toHaveValue('My saved note');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    view.unmount();
  },
);

test('an obsolete read cannot roll back the cache after a save acknowledgment', async () => {
  let resolveSave!: (value: Response) => void;
  let resolveOldRead!: (value: Response) => void;
  let reads = 0;
  const latest = snapshot(2, 'Saved now');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      if (init?.method === 'PUT')
        return new Promise<Response>((resolve) => {
          resolveSave = resolve;
        });
      reads++;
      if (reads === 2)
        return new Promise<Response>((resolve) => {
          resolveOldRead = resolve;
        });
      return response(reads === 1 ? snapshot(1, 'Original') : latest);
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
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Saved now' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(resolveSave).toBeTypeOf('function'));
  void client.invalidateQueries({ queryKey: ['plan-response-draft', 'step'] });
  await waitFor(() => expect(resolveOldRead).toBeTypeOf('function'));
  await act(async () => {
    resolveSave(response(latest));
  });
  await waitFor(() => expect(reads).toBe(3));
  await act(async () => {
    resolveOldRead(response(snapshot(1, 'Obsolete')));
  });
  expect(client.getQueryData(['plan-response-draft', 'step'])).toEqual(latest);
  expect(
    screen.queryByRole('button', { name: 'Review saved response update' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
    'Saved now',
  );
  view.unmount();
});
