import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { theme } from '../theme';
import { GoalIntakePage } from './GoalIntakePage';
import { GoalsPage } from './GoalsPage';

function shell(element: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{element}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

test('PUBLIC-05 presents canonical goal preferences then minimum identity/contact Step 2', () => {
  shell(<GoalIntakePage />);
  expect(screen.getByLabelText(/card type preference/i)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /0% APR/i })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /balance transfer/i })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /rewards \/ points/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/fee preference/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText(/first name/i)).toBeRequired();
  expect(screen.getByLabelText(/last name/i)).toBeRequired();
  expect(screen.getByLabelText(/^email/i)).toBeRequired();
  expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
  expect(screen.getByText(/No account is created yet/i)).toBeInTheDocument();
});

test('PORTAL-03 renders one rich canonical current Goal editor without secondary-goal controls', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/v1/client/goals'))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            goals: [
              {
                id: 'goal-1',
                version: 2,
                goalType: 'TOTAL_AVAILABLE_CREDIT',
                scope: 'BOTH',
                targetAmount: 90000,
                currentAmount: null,
                allowAnnualFee: true,
                cardTypePreference: 'UNSECURED_PREFERRED',
                offerPreferences: ['ZERO_APR', 'REWARDS_POINTS'],
                feePreference: 'PREFER_NO_FEE_OPEN',
                preferenceNote: 'Travel rewards',
                priority: 'PRIMARY',
                status: 'ACTIVE',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    if (url.includes('/api/v1/reviews/client'))
      return Promise.resolve(
        new Response(JSON.stringify({ review: null }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    return Promise.resolve(
      new Response(
        JSON.stringify({
          profile: { freshness: { asOf: null, expiresAt: null, isCurrent: false } },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  });
  shell(<GoalsPage />);
  expect(await screen.findByDisplayValue('Travel rewards')).toBeInTheDocument();
  expect(screen.getByLabelText(/card type preference/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/fee preference/i)).toBeInTheDocument();
  expect(screen.queryByText(/Additional goals/i)).not.toBeInTheDocument();
});
