import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { ConsultantPlanBuilderPage } from './ConsultantPlanBuilderPage';

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ user: { userId: 'consultant' } }) }));
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const fixture = (revision = 3, title = 'Prepare for your review') => ({
  plan: {
    id: 'plan',
    title,
    purpose: 'NURTURE',
    status: 'DRAFT',
    versions: [
      {
        title,
        purpose: 'NURTURE',
        status: 'DRAFT',
        version: 1,
        optimisticVersion: revision,
        paths: [],
        items: ['first', 'second'].map((stableKey, sortOrder) => ({
          stableKey,
          sortOrder,
          type: 'GUIDANCE',
          owner: 'CLIENT',
          completionMode: 'ACKNOWLEDGEMENT',
          clientTitle: `${stableKey} step`,
          clientBody: 'Client instructions',
          consultantRationale: 'Private analysis',
          required: true,
          status: 'LOCKED',
          pathMemberships: [],
          prerequisites: [],
        })),
      },
    ],
  },
  context: {},
});
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/crm/clients/client/plan']}>
          <Routes>
            <Route path="/crm/clients/:clientId/plan" element={<ConsultantPlanBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return Object.assign(client, { unmount: view.unmount });
}
beforeEach(() => {
  sessionStorage.clear();
  request.mockReset();
  request.mockResolvedValue(fixture());
});

test('offers identity verification with a return to the saved draft after denied approval', async () => {
  request.mockImplementation(async (path) => {
    if (path.endsWith('/approve')) throw Object.assign(new Error('Access denied'), { status: 403 });
    return fixture();
  });
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve this version' }),
  );
  expect(await screen.findByRole('link', { name: 'Verify identity' })).toHaveAttribute(
    'href',
    '/mfa?mode=challenge&returnTo=%2Fcrm%2Fclients%2Fclient%2Fplan',
  );
});

test('retains unsaved edits when a background refresh brings a conflicting version', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'My local changes' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'Another saved title'));
  });
  expect(screen.getByDisplayValue('My local changes')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
});

test('failed saves retain edits and permit retry', async () => {
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  request.mockImplementation(async (_path, init) => {
    if (init?.method === 'PUT') throw new Error('Connection interrupted');
    return fixture();
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Keep my work' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText(/Connection interrupted/);
  expect(screen.getByDisplayValue('Keep my work')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});

test('approval preview excludes private rationale and sends the reviewed revision', async () => {
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.click(screen.getByRole('button', { name: 'Review & approve' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).queryByText('Private analysis')).not.toBeInTheDocument();
  expect(within(dialog).getByText('first step')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: /Approve/ }));
  await waitFor(() =>
    expect(request.mock.calls.some(([path]) => path.endsWith('/approve'))).toBe(true),
  );
  const call = request.mock.calls.find(([path]) => path.endsWith('/approve'))!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({ expectedVersion: 3 });
  expect(call[1]?.headers).toBeUndefined();
});

test('restores unfinished edits after remount without advancing their original revision', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Recovered work' },
  });
  view.unmount();
  request.mockResolvedValue(fixture(4, 'Newer server work'));
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Restore unfinished edits' }));
  expect(screen.getByDisplayValue('Recovered work')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
});

test('can discard the tab copy and open the current server Plan', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Discard me' },
  });
  view.unmount();
  setup();
  fireEvent.click(await screen.findByRole('button', { name: 'Discard tab copy' }));
  expect(screen.getByDisplayValue('Prepare for your review')).toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});

test('ignores an expired recovery copy and shows the server version', async () => {
  const view = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Old edits' },
  });
  view.unmount();
  const key = sessionStorage.key(0)!;
  const stored = JSON.parse(sessionStorage.getItem(key)!);
  sessionStorage.setItem(
    key,
    JSON.stringify({ ...stored, savedAt: Date.now() - 25 * 60 * 60 * 1000 }),
  );
  setup();
  await screen.findByDisplayValue('Prepare for your review');
  expect(
    screen.queryByRole('button', { name: 'Restore unfinished edits' }),
  ).not.toBeInTheDocument();
});

test('compares conflicting content without discarding local edits', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'My proposed title' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'Shared revised title'));
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved version' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('My proposed title')).toBeVisible();
  expect(within(dialog).getByText('Shared revised title')).toBeVisible();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my edits' }));
  expect(await screen.findByDisplayValue('My proposed title')).toBeInTheDocument();
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});

test('selected wording uses the newer revision only after explicit save', async () => {
  const client = setup();
  await screen.findByDisplayValue('Prepare for your review');
  fireEvent.change(screen.getByRole('textbox', { name: 'Plan title' }), {
    target: { value: 'Chosen wording' },
  });
  await act(async () => {
    client.setQueryData(['plan-builder', 'client'], fixture(4, 'New saved title'));
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Review saved version' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Keep my Plan title' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Use selected wording in a new working copy' }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Plan title' })).toHaveValue('Chosen wording');
  expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  expect(screen.getByRole('button', { name: 'Review & approve' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(request.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true),
  );
  const write = request.mock.calls.find(([, options]) => options?.method === 'PUT')!;
  expect(JSON.parse(String(write[1]?.body))).toMatchObject({
    expectedVersion: 4,
    draft: { title: 'Chosen wording' },
  });
});
