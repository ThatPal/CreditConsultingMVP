import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { SavedPlanResponse, type DraftResult } from './SavedPlanResponse';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const saved: DraftResult = {
  contextVersion: '2026-09-10T00:00:00.000Z',
  active: true,
  draft: {
    revision: 1,
    updatedAt: '2026-09-10T00:00:00.000Z',
    values: {},
    note: 'My unfinished response',
    help: false,
    files: [],
    unavailableFiles: 0,
  },
};
function setup() {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SavedPlanResponse
          item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }}
        />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
beforeEach(() => request.mockReset());
test('restores a private draft and saves updates without submitting an outcome', async () => {
  request.mockResolvedValue(saved);
  const view = setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
    'My unfinished response',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Updated response' },
  });
  const updated = { ...saved, draft: { ...saved.draft!, revision: 2, note: 'Updated response' } };
  request.mockResolvedValue(updated);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
  const write = request.mock.calls.find(([, options]) => options?.method === 'PUT')!;
  expect(JSON.parse(String(write[1]?.body))).toMatchObject({
    expectedRevision: 1,
    note: 'Updated response',
    contextVersion: saved.contextVersion,
  });
  expect(request.mock.calls.some(([path]) => path.includes('/outcomes'))).toBe(false);
  view.unmount();
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
    'Updated response',
  );
});
test('retains local answers when another tab has saved a newer draft', async () => {
  request.mockResolvedValue(saved);
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Local edits' },
  });
  request.mockRejectedValueOnce(new Error('A newer draft was saved in another tab.'));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(await screen.findByText('A newer draft was saved in another tab.')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
    'Local edits',
  );
});
