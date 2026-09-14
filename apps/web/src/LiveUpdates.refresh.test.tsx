import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { LiveUpdates, parseLiveUpdate } from './LiveUpdates';
import { SavedPlanResponse } from './features/plans/SavedPlanResponse';
import { theme } from './theme';
import { bindRequestActor } from './auth/requestActor';

vi.mock('./auth/AuthProvider', () => ({
  useAuth: () => ({ user: { userId: 'u', clientId: 'c', role: 'CLIENT', status: 'ACTIVE' } }),
}));
class Source extends EventTarget {
  static current: Source;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  close = vi.fn();
  constructor() {
    super();
    Source.current = this;
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  bindRequestActor('u');
});
const emit = (value: unknown) =>
  Source.current.dispatchEvent(new MessageEvent('refresh', { data: JSON.stringify(value) }));

test.each([
  '{',
  'null',
  '[]',
  '{}',
  '{"domains":null}',
  '{"domains":"plan"}',
  '{"domains":[{}]}',
  '{"domains":["__proto__","constructor"]}',
])('ignores invalid refresh input %s', (raw) => expect(parseLiveUpdate(raw)).toBeNull());

test('refresh hints invalidate actual collection queries without changing unrelated data', () => {
  vi.stubGlobal('EventSource', Source);
  const client = new QueryClient();
  const affected = [
    'client-documents',
    'document-picker',
    'plan-library',
    'plan-version-history',
    'plan-draft-library',
    'plan-response-draft',
    'review',
    'review-eligibility',
    'consultant-reviews',
    'consultant-client-journey',
  ];
  for (const key of [...affected, 'payments', 'current-user'])
    client.setQueryData([key, 'scope'], { saved: true });
  const view = render(
    <QueryClientProvider client={client}>
      <LiveUpdates>
        <div>Portal</div>
      </LiveUpdates>
    </QueryClientProvider>,
  );
  act(() => emit({ domains: ['documents', 'plan', 'review', 'journey', 'future-domain', 'plan'] }));
  for (const key of affected)
    expect(client.getQueryState([key, 'scope'])?.isInvalidated).toBe(true);
  for (const key of ['payments', 'current-user'])
    expect(client.getQueryState([key, 'scope'])?.isInvalidated).toBe(false);
  expect(client.getQueryData(['client-documents', 'scope'])).toEqual({ saved: true });
  const source = Source.current;
  view.unmount();
  client.setQueryData(['client-documents', 'scope'], { saved: true });
  source.dispatchEvent(new MessageEvent('refresh', { data: '{"domains":["documents"]}' }));
  expect(client.getQueryState(['client-documents', 'scope'])?.isInvalidated).toBe(false);
});

test('a live saved-response conflict preserves local text and requires explicit review', async () => {
  vi.stubGlobal('EventSource', Source);
  let revision = 1;
  const fetcher = vi.fn().mockImplementation(async (_url, init) => {
    if (init?.method) throw new Error('No automatic write expected during conflict review');
    return new Response(
      JSON.stringify({
        active: true,
        contextVersion: 'context',
        draft: {
          id: 'draft',
          itemId: 'step',
          revision,
          values: {},
          note: revision === 1 ? 'Original note' : 'Saved elsewhere',
          help: false,
          files: [],
          unavailableFiles: 0,
          updatedAt: '2026-09-14T00:00:00Z',
        },
      }),
      { status: 200 },
    );
  });
  vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <LiveUpdates>
          <SavedPlanResponse
            item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }}
          />
        </LiveUpdates>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  const input = screen.getByRole('textbox', { name: 'Optional note for your consultant' });
  await act(async () => {
    emit({ domains: ['plan-drafts'] });
  });
  expect(input).toHaveValue('Original note');
  expect(
    screen.queryByRole('button', { name: 'Review saved response update' }),
  ).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'My local answers' } });
  revision = 2;
  await act(async () => {
    emit({ domains: ['plan-drafts'] });
  });
  const review = await screen.findByRole('button', { name: 'Review saved response update' });
  expect(input).toHaveValue('My local answers');
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  fireEvent.click(review);
  fireEvent.click(screen.getByRole('button', { name: 'Keep local answers' }));
  expect(input).toHaveValue('My local answers');
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved response update' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load saved response' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
      'Saved elsewhere',
    ),
  );
  expect(fetcher.mock.calls.every(([, init]) => !init?.method)).toBe(true);
});
