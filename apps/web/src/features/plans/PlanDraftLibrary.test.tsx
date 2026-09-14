import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { PlanDraftLibrary } from './PlanDraftLibrary';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
function setup() {
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <PlanDraftLibrary />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
beforeEach(() => request.mockReset());
test('loads on demand and opens original answers for a removed step without writing', async () => {
  request.mockResolvedValue({
    drafts: [
      {
        id: 'draft',
        itemId: 'old-step',
        revision: 1,
        version: 1,
        planTitle: 'Earlier Plan',
        title: 'Removed step',
        body: 'Original instructions',
        values: { answer: 'Private saved text' },
        note: '',
        help: false,
        files: [],
        unavailableFiles: 0,
        updatedAt: '2026-09-10T00:00:00Z',
      },
    ],
    nextBefore: null,
  });
  setup();
  expect(request).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Saved response library' }));
  expect(await screen.findByText('Earlier Plan · Removed step')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect saved draft' }));
  expect(await screen.findByRole('textbox', { name: 'Saved answer 1' })).toHaveValue(
    'Private saved text',
  );
  expect(screen.getByText('Original instructions')).toBeVisible();
  expect(request.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
test('loads the next page and reports an empty library', async () => {
  request
    .mockResolvedValueOnce({ drafts: [], nextBefore: 'cursor' })
    .mockResolvedValueOnce({ drafts: [], nextBefore: null });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Saved response library' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Load more drafts' }));
  await screen.findByText('No private response drafts are saved.');
  expect(request).toHaveBeenCalledWith('/api/v1/client/plan/drafts?before=cursor');
});
