import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { theme } from '../theme';
import { GoalIntakePage } from '../pages/GoalIntakePage';
import { RegisterPage, VerifyEmailPage } from '../pages/AuthPages';
import { EntryHandoff } from './EntryHandoff';
import { EntryIntentStrip, GoalSummary } from './EntryComponents';
import { bindRequestActor } from '../auth/requestActor';
import { signalSessionLoss } from '../auth/sessionLoss';
import { forgetIntake, rememberIntake, savedIntakeToken, entryDestination } from './continuation';
import { readEntryDecision, writeEntryDecision } from './decisionRecovery';
import { parseLiveUpdate, queryRootsForLiveDomains } from '../LiveUpdates';
import type { IntakePreview } from '@credit/shared';

const authState = vi.hoisted(() => ({
  user: {
    userId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    role: 'CLIENT',
    email: 'entry@example.test',
  } as Record<string, string> | null,
  refresh: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => authState }));
const token = 'a'.repeat(43);
const values = {
  goalType: 'TOTAL_AVAILABLE_CREDIT',
  scope: 'PERSONAL' as const,
  targetAmount: 75000,
  allowAnnualFee: true,
  cardTypePreference: 'OPEN_TO_SECURED' as const,
  offerPreferences: ['ZERO_APR' as const],
  feePreference: 'FEE_ACCEPTABLE' as const,
  preferenceNote: 'A long factual preference. '.repeat(12),
};
const view: IntakePreview = {
  schemaVersion: 1,
  actorId: '11111111-1111-4111-8111-111111111111',
  clientId: '22222222-2222-4222-8222-222222222222',
  intakeId: '33333333-3333-4333-8333-333333333333',
  intakeVersion: 1,
  goalSetVersion: 0,
  expiresAt: '2026-12-01T00:00:00Z',
  savedGoal: values,
  currentGoal: null,
  state: 'NO_PRIMARY',
  differences: [],
  decisions: [
    { decision: 'APPLY_SAVED', enabled: true },
    { decision: 'KEEP_CURRENT', enabled: false },
  ],
};
const publicDraft = {
  ...values,
  firstName: 'Entry',
  lastName: 'Test',
  email: 'entry@example.test',
  phone: null,
  version: 1,
  expiresAt: view.expiresAt,
};
const response = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
function show(element: React.ReactNode, route = '/app/goals?intake=' + token) {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    cache,
    ...render(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={cache}>
          <MemoryRouter initialEntries={[route]}>{element}</MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    ),
  };
}
beforeEach(() => {
  sessionStorage.clear();
  forgetIntake();
  bindRequestActor(view.actorId);
  authState.user = {
    userId: view.actorId,
    clientId: view.clientId,
    role: 'CLIENT',
    email: 'entry@example.test',
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('ET09 storage read/write/remove failures retain same-page handoff without throwing', () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const)
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new Error('Storage blocked');
    });
  expect(() => rememberIntake(token)).not.toThrow();
  expect(savedIntakeToken()).toBe(token);
  expect(() => forgetIntake()).not.toThrow();
  expect(savedIntakeToken()).toBe('');
});
test('ET08 saved editor submits loaded revision, without refreshing old values onto a new revision', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((_url, options) =>
      options?.method === 'PATCH'
        ? response(
            { error: { code: 'STALE_INTAKE', message: 'Goal intake changed or expired' } },
            409,
          )
        : response({ intake: publicDraft }),
    );
  show(<GoalIntakePage />, '/goal-intake?intake=' + token);
  fireEvent.click(await screen.findByRole('button', { name: 'Review or edit goal' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Goal amount' }), {
    target: { value: '85000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue securely' }));
  await screen.findByText('Goal intake changed or expired');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).toMatchObject({
    version: 1,
    targetAmount: 85000,
  });
  expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))).not.toHaveProperty('expiresAt');
});
test('ET09 successful public save still offers auth links when persistence is blocked', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    response({ token, intake: publicDraft }, 201),
  );
  show(<GoalIntakePage />, '/goal-intake');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'Entry' } });
  fireEvent.change(screen.getByLabelText(/Last name/), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'entry@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue securely' }));
  expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
    'href',
    '/register?intake=' + token,
  );
  expect(screen.queryByText(/Unable to save/)).not.toBeInTheDocument();
});
test('ET13 delayed registration prefill cannot overwrite typed contact fields', async () => {
  authState.user = null;
  let complete!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  show(<RegisterPage />, '/register?intake=' + token);
  fireEvent.change(screen.getByLabelText(/First name/), { target: { value: 'My typed name' } });
  await act(async () => complete(new Response(JSON.stringify({ intake: publicDraft }))));
  expect(screen.getByDisplayValue('My typed name')).toBeInTheDocument();
});
test('ET05 forged verification flags never assert email verification', () => {
  authState.user = null;
  show(<VerifyEmailPage />, '/verify-email?status=success');
  expect(screen.queryByText('Email verified')).not.toBeInTheDocument();
  expect(screen.getByText(/does not confirm verification/)).toBeInTheDocument();
});
test('ET04 role-compatible entry destinations and ordinary login are preserved', () => {
  expect(entryDestination(new URLSearchParams('intake=' + token), 'CONSULTANT', '/crm')).toBe(
    '/crm',
  );
  expect(entryDestination(new URLSearchParams(), 'CLIENT', '/app')).toBe('/app');
  expect(
    entryDestination(new URLSearchParams('returnTo=https://evil.test'), 'CLIENT', '/app'),
  ).toBe('/app');
  expect(entryDestination(new URLSearchParams('returnTo=/admin'), 'CLIENT', '/app')).toBe('/app');
});
test('ET10 an uncertain decision retries the exact body/key and never enables a competing choice', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((url) =>
      String(url).endsWith('/preview')
        ? response(view)
        : Promise.reject(new Error('Response lost')),
    );
  show(<EntryHandoff />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save this goal' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry same decision' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  expect(fetch.mock.calls[1]?.[1]?.body).toBe(fetch.mock.calls[2]?.[1]?.body);
  expect(fetch.mock.calls[1]?.[1]?.headers).toEqual(fetch.mock.calls[2]?.[1]?.headers);
  expect(screen.queryByRole('button', { name: 'Not now' })).not.toBeInTheDocument();
  const stored = readEntryDecision(view.actorId, view.clientId, view.intakeId);
  expect(stored?.decision).toBe('APPLY_SAVED');
  expect(JSON.stringify(stored)).not.toContain(token);
});
test('ET13 delayed preview after session loss is discarded and cannot be submitted', async () => {
  let complete!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  show(<EntryHandoff />);
  act(() => signalSessionLoss());
  await act(async () => complete(new Response(JSON.stringify(view))));
  expect(screen.queryByRole('button', { name: 'Save this goal' })).not.toBeInTheDocument();
});
test('ET10 interrupted handoff restores an explicit original retry, without submitting on mount', async () => {
  writeEntryDecision(view.actorId, view.clientId, {
    key: crypto.randomUUID(),
    intakeId: view.intakeId,
    decision: 'APPLY_SAVED',
    expectedIntakeVersion: 1,
    expectedGoalSetVersion: 0,
    expectedCurrentGoal: null,
  });
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => response(view));
  show(<EntryHandoff />);
  await screen.findByRole('button', { name: 'Retry same decision' });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('ET14 existing live channel recognizes Goal invalidations and refreshes authoritative readers', () => {
  expect(parseLiveUpdate(JSON.stringify({ domains: ['goals'] }))).toEqual({ domains: ['goals'] });
  expect(queryRootsForLiveDomains(['goals'])).toEqual(
    expect.arrayContaining(['goals', 'portal-home', 'portal-journey']),
  );
});
test('ET15 complete reusable summaries retain all fields and full notes', () => {
  show(
    <>
      <GoalSummary values={values} />
      <EntryIntentStrip state="UNAVAILABLE" />
    </>,
  );
  for (const name of [
    'Goal type',
    'Scope',
    'Target',
    'Annual fee allowed',
    'Card preference',
    'Offers',
    'Fee preference',
    'Additional preference',
  ])
    expect(screen.getByText(name)).toBeInTheDocument();
  expect(screen.getByText(values.preferenceNote.trim())).toBeInTheDocument();
});

test('ET13 committed response arriving after session loss cannot populate the next account', async () => {
  let finish!: (value: Response) => void;
  vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => response(view))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  show(<EntryHandoff />);
  fireEvent.click(await screen.findByRole('button', { name: 'Save this goal' }));
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  act(() => signalSessionLoss());
  await act(async () =>
    finish(
      new Response(
        JSON.stringify({
          resolution: {
            intakeId: view.intakeId,
            effect: 'CREATED',
            goalVersion: 1,
            resolvedAt: new Date().toISOString(),
          },
        }),
      ),
    ),
  );
  expect(screen.queryByText('Your saved goal was applied.')).not.toBeInTheDocument();
});
