import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { NavigationProtection } from '../NavigationProtection';
import { GoalsPage } from './GoalsPage';
vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const goal = (version = 1) => ({
  id: 'goal',
  version,
  goalType: 'TOTAL_AVAILABLE_CREDIT',
  scope: 'PERSONAL',
  targetAmount: 50000,
  currentAmount: null,
  allowAnnualFee: false,
  cardTypePreference: 'NO_PREFERENCE',
  offerPreferences: [],
  feePreference: 'NO_ANNUAL_FEE_ONLY',
  preferenceNote: 'Saved wording',
  priority: 'PRIMARY',
  status: 'ACTIVE',
});
beforeEach(() => {
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path) =>
      path === '/api/v1/client/goals'
        ? { goals: [goal()] }
        : path.includes('reviews')
          ? { review: null }
          : { profile: { freshness: { isCurrent: false } } },
    );
});
function setup() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationProtection>
            <GoalsPage />
            <Link to="/elsewhere">Leave goals</Link>
          </NavigationProtection>
        ),
      },
    ],
    { initialEntries: ['/goals'] },
  );
  render(
    <QueryClientProvider client={cache}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { cache, router };
}
test('keeps edits on same-version refresh and requires explicit replacement after a new version', async () => {
  const { cache } = setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.change(screen.getByRole('textbox', { name: 'Additional card preference (optional)' }), {
    target: { value: 'My unfinished wording' },
  });
  await act(async () => {
    cache.setQueryData(['goals'], { goals: [{ ...goal(), currentAmount: 1000 }] });
  });
  expect(screen.getByDisplayValue('My unfinished wording')).toBeVisible();
  await act(async () => {
    cache.setQueryData(['goals'], {
      goals: [{ ...goal(2), preferenceNote: 'Another saved wording' }],
    });
  });
  await screen.findByText(/The saved goal changed/);
  expect(screen.getByRole('button', { name: 'Save primary goal' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Review saved goal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Keep my edits' }));
  expect(screen.getByDisplayValue('My unfinished wording')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Review saved goal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load saved goal' }));
  await screen.findByDisplayValue('Another saved wording');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Save primary goal' }));
  await waitFor(() =>
    expect(
      vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(true),
  );
  const call = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === 'PATCH')!;
  expect(JSON.parse(String(call[1]?.body))).not.toHaveProperty('priority');
  expect(JSON.parse(String(call[1]?.body))).toMatchObject({
    version: 2,
    preferenceNote: 'Another saved wording',
  });
});
test('retains edits after a failed background read and guards leaving', async () => {
  const { cache, router } = setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.change(screen.getByRole('textbox', { name: 'Additional card preference (optional)' }), {
    target: { value: 'Keep this text' },
  });
  vi.mocked(apiRequest).mockRejectedValue(new Error('Offline'));
  await act(async () => {
    await cache.invalidateQueries({ queryKey: ['goals'] });
  });
  expect(await screen.findByText(/Goals could not be refreshed/)).toBeVisible();
  expect(screen.getByDisplayValue('Keep this text')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save primary goal' })).toBeDisabled();
  fireEvent.click(screen.getByRole('link', { name: 'Leave goals' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Stay on this page' }));
  expect(router.state.location.pathname).toBe('/goals');
});
test('freezes submitted fields until save and refresh finish', async () => {
  let finish!: (value: unknown) => void;
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation((path, options) =>
    options?.method === 'PATCH'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : base(path, options),
  );
  setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Save primary goal' }));
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: 'Additional card preference (optional)' }),
    ).toBeDisabled(),
  );
  await act(async () => {
    finish({});
  });
  await screen.findByText('Primary goal updated.');
  expect(
    screen.getByRole('textbox', { name: 'Additional card preference (optional)' }),
  ).toBeEnabled();
});

test('rejects targets outside the API range and fractional dollars before sending', async () => {
  setup();
  await screen.findByDisplayValue('Saved wording');
  const input = screen.getByRole('spinbutton', { name: 'Exact target' });
  for (const value of ['4999', '250001', '5000.5', '']) {
    fireEvent.change(input, { target: { value } });
    expect(screen.getByRole('button', { name: 'Save primary goal' })).toBeDisabled();
  }
  fireEvent.change(input, { target: { value: '5000' } });
  expect(screen.getByRole('button', { name: 'Save primary goal' })).toBeEnabled();
  expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(
    false,
  );
});
