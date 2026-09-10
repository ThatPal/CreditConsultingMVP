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
