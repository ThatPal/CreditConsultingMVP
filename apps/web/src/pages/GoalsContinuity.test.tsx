import { signalSessionLoss } from '../auth/sessionLoss';
import { clearPlanTabRecovery } from '../auth/tabRecovery';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, Link } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { NavigationProtection } from '../NavigationProtection';
import { GoalsPage } from './GoalsPage';
vi.mock('../auth/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/api')>()),
  apiRequest: vi.fn(),
}));
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
  sessionStorage.clear();
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) =>
      options?.method === 'PATCH'
        ? { goal: goal(2) }
        : path === '/api/v1/client/goals'
          ? { goals: [goal()] }
          : path.includes('reviews')
            ? { review: null }
            : { profile: { freshness: { isCurrent: false } } },
    );
});
function setup(path = '/goals') {
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
    { initialEntries: [path] },
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

test('checks an accepted save after a failed read without sending another update', async () => {
  let saved = false;
  let offline = true;
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') {
      saved = true;
      return {};
    }
    if (path === '/api/v1/client/goals' && saved) {
      if (offline) throw new Error('Read unavailable');
      return { goals: [goal(2)] };
    }
    return base(path, options);
  });
  setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Save primary goal' }));
  const retry = await screen.findByRole('button', { name: 'Check saved goal' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(screen.getByText('Primary goal updated.')).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: 'Additional card preference (optional)' }),
  ).toBeDisabled();
  offline = false;
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Check saved goal' })).not.toBeInTheDocument(),
  );
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'PATCH'),
  ).toHaveLength(1);
});

test('replays an unconfirmed save with the original body and idempotency key', async () => {
  let attempts = 0;
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') {
      if (++attempts === 1) throw new Error('Response lost');
      return {};
    }
    return base(path, options);
  });
  setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Save primary goal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry same save' }));
  await screen.findByText('Primary goal updated.');
  const writes = vi
    .mocked(apiRequest)
    .mock.calls.filter(([, options]) => options?.method === 'PATCH');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});

test('retries cycle confirmation separately from the accepted goal write', async () => {
  let confirmations = 0;
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (path.endsWith('/confirm-goal')) {
      if (++confirmations === 1) throw new Error('Cycle unavailable');
      return {};
    }
    return base(path, options);
  });
  const { router } = setup('/goals?cycle=test-cycle');
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm goal for this cycle' }));
  const retry = await screen.findByRole('button', { name: 'Retry cycle confirmation' });
  await waitFor(() => expect(retry).toBeEnabled());
  expect(router.state.location.pathname).toBe('/goals');
  fireEvent.click(retry);
  await waitFor(() => expect(router.state.location.pathname).toBe('/app/application-rounds'));
  expect(confirmations).toBe(2);
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'PATCH'),
  ).toHaveLength(1);
});

vi.mock('../auth/AuthProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/AuthProvider')>()),
  useAuth: () => ({ user: { userId: 'goal-test-user', clientId: 'goal-test-client' } }),
}));

test('restores a lost response after remount and requires explicit replay', async () => {
  let attempts = 0;
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') {
      if (++attempts === 1) throw new Error('Lost');
      return {};
    }
    return base(path, options);
  });
  setup();
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Save primary goal' }));
  await screen.findByRole('button', { name: 'Retry same save' });
  const original = vi
    .mocked(apiRequest)
    .mock.calls.find(([, options]) => options?.method === 'PATCH');
  cleanup();
  setup();
  await screen.findByText(/An unfinished goal save was recovered/);
  expect(attempts).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry same save' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Retry same save' })).not.toBeInTheDocument(),
  );
  expect(
    vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === 'PATCH')[1],
  ).toEqual(original);
  await waitFor(() => expect(sessionStorage.length).toBe(0));
});

test('does not restore cleared recovery when a save finishes after session loss', async () => {
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
  await waitFor(() => expect(sessionStorage.length).toBe(1));
  act(() => {
    signalSessionLoss();
    clearPlanTabRecovery();
  });
  await act(async () => {
    finish({});
  });
  await screen.findByText('Primary goal updated.');
  expect(sessionStorage.length).toBe(0);
});

test('confirms the saved request revision rather than a later read and offers conflict review', async () => {
  const base = vi.mocked(apiRequest).getMockImplementation()!;
  vi.mocked(apiRequest).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { goal: goal(8) };
    if (path.endsWith('/confirm-goal'))
      throw Object.assign(new Error('Goal changed'), { code: 'CYCLE_GOAL_STALE' });
    return base(path, options);
  });
  setup('/goals?cycle=test-cycle');
  await screen.findByDisplayValue('Saved wording');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm goal for this cycle' }));
  const review = await screen.findByRole('button', { name: 'Review current goal' });
  await waitFor(() => expect(review).toBeEnabled());
  const confirmation = vi
    .mocked(apiRequest)
    .mock.calls.find(([path]) => path.endsWith('/confirm-goal'))!;
  expect(JSON.parse(String(confirmation[1]?.body))).toEqual({ goalId: 'goal', goalVersion: 2 });
  expect(screen.getByRole('button', { name: 'Retry cycle confirmation' })).toBeDisabled();
  fireEvent.click(review);
  expect(screen.getByRole('button', { name: 'Confirm goal for this cycle' })).toBeEnabled();
});
