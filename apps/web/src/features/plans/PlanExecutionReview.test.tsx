import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { NavigationProtection } from '../../NavigationProtection';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { PlanExecutionReview } from './PlanExecutionReview';
beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(apiRequest).mockReset();
});
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
test('requires a client-visible correction message and binds review to the displayed evidence', async () => {
  const request = vi.mocked(apiRequest);
  request.mockReset();
  request.mockResolvedValue({
    plan: {
      status: 'ACTIVE',
      version: {
        items: [
          {
            id: 'item',
            title: 'Statement update',
            body: 'Review the submitted statement details.',
            status: 'AWAITING_VERIFICATION',
            completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
            latestOutcomeId: 'evidence-2',
            history: [
              {
                id: 'evidence-2',
                kind: 'COMPLETE',
                data: { balance: 0 },
                createdAt: '2026-09-10T12:00:00Z',
              },
            ],
          },
        ],
      },
    },
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PlanExecutionReview clientId="client" planId="selected-plan" />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await screen.findByText('1 step needs verification');
  expect(request).toHaveBeenCalledWith(
    '/api/v1/consultant/clients/client/plan/execution?planId=selected-plan',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
  await screen.findByText('Explain what the client should correct.');
  expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: 'Message to the client' }), {
    target: { value: 'Please use your latest statement.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
  await waitFor(() =>
    expect(request.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true),
  );
  const call = request.mock.calls.find(([, init]) => init?.method === 'POST')!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    decision: 'RETURN',
    expectedOutcomeId: 'evidence-2',
    note: 'Please use your latest statement.',
  });
  expect(screen.getByText('Client submitted an update')).toBeInTheDocument();
});

function reviewFixture(status: string) {
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockResolvedValue({
    plan: {
      status: 'ACTIVE',
      version: {
        items: [
          {
            id: 'help-step',
            title: 'Read guidance',
            body: 'Prepare for review.',
            status,
            completionMode: 'ACKNOWLEDGEMENT',
            latestOutcomeId: 'help-event',
            history: [
              {
                id: 'help-event',
                kind: status === 'COMPLETED' ? 'COMPLETE' : 'UNABLE',
                data: { reason: 'I cannot find the guide.' },
                createdAt: '2026-09-10T12:00:00Z',
              },
            ],
          },
        ],
      },
    },
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PlanExecutionReview clientId="client" />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
test('requires helpful guidance and reopens the exact request without offering verification', async () => {
  reviewFixture('UNABLE');
  const send = await screen.findByRole('button', { name: 'Send guidance & reopen step' });
  expect(screen.queryByRole('button', { name: 'Verify completion' })).not.toBeInTheDocument();
  fireEvent.click(send);
  expect(await screen.findByText('Explain how the client can continue.')).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Message to the client' }), {
    target: { value: 'Open the preparation guide in Documents.' },
  });
  fireEvent.click(send);
  await waitFor(() =>
    expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
      true,
    ),
  );
  const call = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === 'POST')!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({
    decision: 'RESUME',
    expectedOutcomeId: 'help-event',
    note: 'Open the preparation guide in Documents.',
  });
});
test('keeps completed responses accessible with no decision controls', async () => {
  reviewFixture('COMPLETED');
  fireEvent.click(await screen.findByRole('button', { name: 'All steps (1)' }));
  expect(await screen.findByText('Client submitted an update')).toBeVisible();
  expect(screen.queryByRole('textbox', { name: 'Message to the client' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Verify completion' })).not.toBeInTheDocument();
});

test('opens a stable linked step instead of silently reviewing the first step', async () => {
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockResolvedValue({
    plan: {
      status: 'ACTIVE',
      version: {
        items: [
          {
            id: 'first',
            stableKey: 'first',
            title: 'First response',
            status: 'COMPLETED',
            completionMode: 'ACKNOWLEDGEMENT',
            history: [],
          },
          {
            id: 'new-version-id',
            stableKey: 'linked',
            title: 'Linked response',
            body: 'This is the requested response.',
            status: 'COMPLETED',
            completionMode: 'ACKNOWLEDGEMENT',
            history: [],
          },
        ],
      },
    },
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/plan?stepKey=linked']}>
          <PlanExecutionReview clientId="client" planId="plan" />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  expect(await screen.findByText('This is the requested response.')).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Step to review' })).toHaveTextContent(
    'Linked response',
  );
});

test('a stale step link explains the missing source instead of selecting another response', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    plan: {
      status: 'ACTIVE',
      version: {
        items: [
          {
            id: 'other',
            stableKey: 'other',
            title: 'Other response',
            body: 'Do not select this automatically',
            status: 'COMPLETED',
            history: [],
          },
        ],
      },
    },
  });
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/plan?stepKey=missing']}>
          <PlanExecutionReview clientId="client" planId="plan" />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  expect(await screen.findByText(/The linked step is not in this view/)).toBeVisible();
  expect(screen.queryByText('Do not select this automatically')).not.toBeInTheDocument();
});

test('keeps unsent review notes across filters and guards leaving the Plan', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    plan: {
      status: 'ACTIVE',
      version: {
        items: [
          {
            id: 'pending',
            stableKey: 'pending',
            title: 'Pending review',
            status: 'AWAITING_VERIFICATION',
            completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
            latestOutcomeId: 'evidence',
            history: [],
          },
        ],
      },
    },
  });
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationProtection>
            <PlanExecutionReview clientId="client" planId="plan" />
            <Link to="/elsewhere">Leave Plan</Link>
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/plan'] },
  );
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
  const field = await screen.findByRole('textbox', { name: 'Message to the client' });
  fireEvent.change(field, { target: { value: 'Please clarify the amount' } });
  fireEvent.click(screen.getByRole('button', { name: 'All steps (1)' }));
  expect(screen.getByRole('textbox', { name: 'Message to the client' })).toHaveValue(
    'Please clarify the amount',
  );
  fireEvent.click(screen.getByRole('link', { name: 'Leave Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Stay on this page' }));
  expect(router.state.location.pathname).toBe('/plan');
  expect(await screen.findByRole('textbox', { name: 'Message to the client' })).toHaveValue(
    'Please clarify the amount',
  );
});

const notePlan = (evidenceId: string) => ({
  plan: {
    id: 'plan',
    status: 'ACTIVE',
    version: {
      items: [
        {
          id: 'item',
          stableKey: 'follow-up',
          title: 'Follow-up response',
          status: 'AWAITING_VERIFICATION',
          completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY',
          latestOutcomeId: evidenceId,
          history: [],
        },
      ],
    },
  },
});
function noteWorkspace(actorId = 'consultant') {
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PlanExecutionReview clientId="client" planId="plan" actorId={actorId} />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
test('recovers unsent wording after reload and blocks sending it against changed evidence', async () => {
  vi.mocked(apiRequest).mockResolvedValue(notePlan('old-evidence'));
  const first = noteWorkspace();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Message to the client' }), {
    target: { value: 'Please confirm the balance' },
  });
  await waitFor(() =>
    expect(sessionStorage.getItem('astra:plan-review-notes:v1:consultant:client:plan')).toContain(
      'Please confirm the balance',
    ),
  );
  first.unmount();
  vi.mocked(apiRequest).mockResolvedValue(notePlan('new-evidence'));
  noteWorkspace();
  expect(await screen.findByRole('textbox', { name: 'Message to the client' })).toHaveValue(
    'Please confirm the balance',
  );
  expect(screen.getByRole('button', { name: 'Request correction' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'I reviewed the latest response' }));
  expect(screen.getByRole('button', { name: 'Request correction' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
  await waitFor(() =>
    expect(sessionStorage.getItem('astra:plan-review-notes:v1:consultant:client:plan')).toBeNull(),
  );
  const sent = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === 'POST');
  expect(JSON.parse(sent![1]!.body as string)).toMatchObject({
    expectedOutcomeId: 'new-evidence',
    note: 'Please confirm the balance',
  });
});

test('does not expose another consultant copy and retains orphan text for explicit discard', async () => {
  sessionStorage.setItem(
    'astra:plan-review-notes:v1:first:client:plan',
    JSON.stringify({
      format: 1,
      notes: {
        old: {
          text: 'Private old response note',
          title: 'Earlier step',
          evidenceId: 'old',
          updatedAt: Date.now(),
        },
      },
    }),
  );
  vi.mocked(apiRequest).mockResolvedValue(notePlan('evidence'));
  const other = noteWorkspace('second');
  await screen.findByRole('textbox', { name: 'Message to the client' });
  expect(screen.queryByRole('button', { name: /Unsent messages/ })).not.toBeInTheDocument();
  other.unmount();
  noteWorkspace('first');
  fireEvent.click(await screen.findByRole('button', { name: 'Unsent messages (1)' }));
  expect(screen.getByText('Private old response note')).toBeVisible();
  expect(screen.getByText(/earlier or unavailable step/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Discard message for Earlier step' }));
  await waitFor(() =>
    expect(sessionStorage.getItem('astra:plan-review-notes:v1:first:client:plan')).toBeNull(),
  );
});

test('expired review copies are not restored into a current response', async () => {
  sessionStorage.setItem(
    'astra:plan-review-notes:v1:consultant:client:plan',
    JSON.stringify({
      format: 1,
      notes: {
        item: {
          text: 'Expired wording',
          title: 'Follow-up response',
          evidenceId: 'evidence',
          updatedAt: Date.now() - 86400001,
        },
      },
    }),
  );
  vi.mocked(apiRequest).mockResolvedValue(notePlan('evidence'));
  noteWorkspace();
  expect(await screen.findByRole('textbox', { name: 'Message to the client' })).toHaveValue('');
  expect(sessionStorage.getItem('astra:plan-review-notes:v1:consultant:client:plan')).toBeNull();
});

test('storage denial leaves review usable and clearly reports recovery unavailability', async () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  try {
    vi.mocked(apiRequest).mockResolvedValue(notePlan('evidence'));
    noteWorkspace();
    expect(await screen.findByText(/could not keep a recovery copy/)).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message to the client' }), {
      target: { value: 'Still editable' },
    });
    expect(screen.getByRole('textbox', { name: 'Message to the client' })).toHaveValue(
      'Still editable',
    );
  } finally {
    read.mockRestore();
  }
});
