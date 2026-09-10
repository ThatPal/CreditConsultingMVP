import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { ConsultantPlanBuilderPage } from './ConsultantPlanBuilderPage';

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
  render(
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
  return client;
}
beforeEach(() => {
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
