import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { theme } from '../../theme';
import { PlanResponse, type ResponseItem } from './PlanResponse';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
const item: ResponseItem = {
  id: 'step',
  type: 'ACTION',
  completionMode: 'STRUCTURED_OUTCOME',
  responseForm: {
    error: null,
    fields: [
      { key: 'balance', label: 'Current balance', type: 'number', required: true, minimum: 0 },
      { key: 'confirmed', label: 'Confirmed', type: 'boolean', required: true },
    ],
  },
};
function setup(value = item) {
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={new QueryClient()}>
        <PlanResponse item={value} />
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({});
});
test('sends typed zero and false answers and reuses the submission key after an uncertain failure', async () => {
  request.mockRejectedValueOnce(new Error('Connection interrupted'));
  setup();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Current balance' }), {
    target: { value: '0' },
  });
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Confirmed' }));
  fireEvent.click(await screen.findByRole('option', { name: 'No' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await screen.findByText(/Connection interrupted/);
  expect(screen.getByRole('spinbutton', { name: 'Current balance' })).toHaveValue(0);
  fireEvent.click(screen.getByRole('button', { name: 'Save completed step' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  const first = JSON.parse(String(request.mock.calls[0]![1]?.body));
  const retry = JSON.parse(String(request.mock.calls[1]![1]?.body));
  expect(first.outcome).toEqual({ balance: 0, confirmed: false });
  expect(retry.idempotencyKey).toBe(first.idempotencyKey);
  expect(request.mock.calls[0]![1]?.headers).toBeUndefined();
});
test('a missing response form blocks completion but still allows a specific help request', async () => {
  setup({ ...item, responseForm: { fields: [], error: 'Needs configuration' } });
  expect(screen.getByRole('button', { name: 'Save completed step' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'I need help' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'What do you need help with?' }), {
    target: { value: 'I cannot find the report date.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send help request' }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(request.mock.calls[0]![1]?.body))).toMatchObject({
    action: 'UNABLE',
    reason: 'I cannot find the report date.',
  });
});
