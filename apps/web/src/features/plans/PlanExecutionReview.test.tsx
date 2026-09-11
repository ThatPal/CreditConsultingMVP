import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { PlanExecutionReview } from './PlanExecutionReview';
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
          <PlanExecutionReview clientId="client" />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  await screen.findByText('1 step needs verification');
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
