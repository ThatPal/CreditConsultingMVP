import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { apiRequest } from '../../auth/api';
import { CancelPrivatePlan } from './CancelPrivatePlan';
vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
test('requires a reason, explains scope and replays the same cancellation after a lost response', async () => {
  const request = vi.mocked(apiRequest);
  request.mockReset();
  request
    .mockRejectedValueOnce(new Error('Connection interrupted'))
    .mockResolvedValue({ status: 'CANCELLED' });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CancelPrivatePlan
        clientId="client"
        planId="draft"
        title="Private preparation"
        revision={4}
        disabled={false}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel unpublished Plan' }));
  expect(screen.getByRole('button', { name: 'Cancel this Plan' })).toBeDisabled();
  expect(screen.getByText(/published Plan is unchanged/)).toBeVisible();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason for cancellation' }), {
    target: { value: 'Duplicate draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel this Plan' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry cancellation' }));
  await waitFor(() => expect(request.mock.calls[1]).toEqual(request.mock.calls[0]));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({
    expectedVersion: 4,
    reason: 'Duplicate draft',
  });
});
