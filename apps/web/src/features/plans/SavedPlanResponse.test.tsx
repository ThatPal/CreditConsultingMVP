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
function setup(readOnly = false) {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SavedPlanResponse
          item={{ id: 'step', type: 'ACTION', completionMode: 'ACKNOWLEDGEMENT' }}
          readOnly={readOnly}
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

test('autosaves after editing and queues edits made during a pending save', async () => {
  let finish!: (value: unknown) => void;
  let writes = 0;
  request.mockImplementation(async (_path, options) => {
    if (options?.method !== 'PUT') return saved;
    writes++;
    const body = JSON.parse(String(options.body));
    if (writes === 1)
      return new Promise((resolve) => {
        finish = resolve;
      });
    return { ...saved, draft: { ...saved.draft!, revision: 3, note: body.note } };
  });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  const input = screen.getByRole('textbox', { name: 'Optional note for your consultant' });
  fireEvent.change(input, { target: { value: 'First edit' } });
  await waitFor(() => expect(writes).toBe(1), { timeout: 3000 });
  expect(input).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Save completed step' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Second edit while saving' } });
  finish({ ...saved, draft: { ...saved.draft!, revision: 2, note: 'First edit' } });
  await waitFor(() => expect(writes).toBe(2), { timeout: 3000 });
  const calls = request.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(JSON.parse(String(calls[1]![1]?.body))).toMatchObject({
    expectedRevision: 2,
    note: 'Second edit while saving',
  });
  await screen.findByText('Draft saved privately. Your consultant has not received it.');
  expect(input).toHaveValue('Second edit while saving');
});
test('pauses automatic retries after a save failure and keeps the latest edits', async () => {
  request.mockImplementation(async (_path, options) => {
    if (options?.method === 'PUT') throw new Error('Save connection interrupted');
    return saved;
  });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Keep these edits' },
  });
  await screen.findByText('Save connection interrupted', {}, { timeout: 3000 });
  fireEvent.change(screen.getByRole('textbox', { name: 'Optional note for your consultant' }), {
    target: { value: 'Keep newer edits too' },
  });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  expect(request.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  expect(screen.getByRole('textbox', { name: 'Optional note for your consultant' })).toHaveValue(
    'Keep newer edits too',
  );
});

test.each([false, true])(
  'paused drafts remain readable without save or submission controls (parent pause %s)',
  async (parentPause) => {
    request.mockResolvedValue({
      ...saved,
      active: parentPause,
      draft: {
        ...saved.draft!,
        values: { answer: 'Saved preparation details' },
        unavailableFiles: 1,
      },
    });
    setup(parentPause);
    const note = await screen.findByRole('textbox', { name: 'Saved note' });
    expect(note).toHaveValue('My unfinished response');
    expect(note).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Saved answer 1' })).toHaveValue(
      'Saved preparation details',
    );
    expect(screen.getByText(/Some saved attachments are no longer available/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resume saved response' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save completed step' })).not.toBeInTheDocument();
    expect(request.mock.calls.every(([, options]) => !options?.method)).toBe(true);
  },
);

test('earlier draft inspection retains old labels and does not replace the current response', async () => {
  request.mockResolvedValue({
    ...saved,
    previousDraft: {
      values: { oldField: 'Earlier answer' },
      note: 'Earlier note',
      help: false,
      files: [],
      unavailableFiles: 0,
      version: 1,
      title: 'Earlier instructions',
      body: 'Earlier context',
      updatedAt: saved.draft!.updatedAt,
      responseForm: {
        fields: [{ key: 'oldField', label: 'Original question', type: 'string', required: true }],
        error: null,
      },
    },
  });
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Resume saved response' }));
  const current = screen.getByRole('textbox', { name: 'Optional note for your consultant' });
  fireEvent.click(screen.getByRole('button', { name: 'View earlier draft' }));
  const earlier = await screen.findByRole('textbox', { name: 'Original question' });
  expect(earlier).toHaveValue('Earlier answer');
  expect(earlier).toHaveAttribute('readonly');
  expect(screen.getByText('Earlier instructions')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(current).toHaveValue('My unfinished response');
  expect(request.mock.calls.every(([, options]) => !options?.method)).toBe(true);
});
