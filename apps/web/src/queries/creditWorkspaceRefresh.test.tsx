import { afterEach, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { creditWorkspaceRefetchInterval } from './creditWorkspace';
afterEach(() => vi.useRealTimers());
const source = (refreshAt: string | null, status = 'success') => ({
  state: {
    status,
    dataUpdatedAt: Date.now(),
    data: { workspace: { generatedAt: '2026-09-16T12:00:00Z', refreshAt } },
  },
});
test('uses server-relative elapsed time even when the browser date differs', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2030-01-01'));
  const query = source('2026-09-16T12:01:00Z');
  expect(creditWorkspaceRefetchInterval(query)).toBe(60000);
  vi.advanceTimersByTime(20000);
  expect(creditWorkspaceRefetchInterval(query)).toBe(40000);
});
test('does not poll missing, expired, invalid or failed reads', () => {
  for (const date of [null, 'invalid', '2026-09-16T11:00:00Z', '2026-09-16T12:00:00Z'])
    expect(creditWorkspaceRefetchInterval(source(date))).toBe(false);
  expect(creditWorkspaceRefetchInterval(source('2026-09-16T12:01:00Z', 'error'))).toBe(false);
  expect(
    creditWorkspaceRefetchInterval({
      state: { data: undefined, dataUpdatedAt: 0, status: 'pending' },
    }),
  ).toBe(false);
  expect(creditWorkspaceRefetchInterval(source('2027-01-01'))).toBe(86400000);
});
test('mounted query refetches at the hint and stops after server clears it', async () => {
  vi.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchRead = vi
    .fn()
    .mockResolvedValueOnce({
      label: 'Before',
      workspace: { generatedAt: '2026-09-16T12:00:00Z', refreshAt: '2026-09-16T12:00:02Z' },
    })
    .mockResolvedValue({
      label: 'After',
      workspace: { generatedAt: '2026-09-16T12:00:02Z', refreshAt: null },
    });
  function Probe() {
    const q = useQuery<{
      label: string;
      workspace: { generatedAt: string; refreshAt: string | null };
    }>({
      queryKey: ['timed-read'],
      queryFn: fetchRead,
      refetchInterval: creditWorkspaceRefetchInterval,
    });
    return <span>{q.data?.label}</span>;
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(screen.getByText('Before')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2100);
  });
  expect(screen.getByText('After')).toBeInTheDocument();
  expect(fetchRead).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(fetchRead).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
});
