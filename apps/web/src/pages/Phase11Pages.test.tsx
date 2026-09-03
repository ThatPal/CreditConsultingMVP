import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { MajorApplicationCheckPage, RoundPage, SeasonalCyclePage } from './Phase11Pages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const wrapper = (children: React.ReactNode, path = '/') => render(<ThemeProvider theme={theme}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider></ThemeProvider>);

const round = {
  round: { id: '11111111-1111-4111-8111-111111111111', status: 'PREPARATION', cycle: { displayName: 'Fall 2026' }, goalSnapshot: { goalType: 'TOTAL_AVAILABLE_CREDIT', scope: 'PERSONAL', targetAmount: '50000' }, preparationPlanVersion: { items: [{ id: 'item', clientTitle: 'Confirm balances', status: 'AVAILABLE', required: true }] }, serviceEntitlement: { status: 'CONSUMED' } },
  readiness: { profileCurrent: true, preparationComplete: false, majorCheckComplete: false, coordinationRequired: false, strategyReady: false, blockers: ['PREPARATION_INCOMPLETE', 'MAJOR_CHECK_REQUIRED'] },
  majorCheck: null,
  primaryAction: { label: 'Complete preparation', path: '/app/plan' },
};

describe('PORTAL-25 and PORTAL-26', () => {
  beforeEach(() => mockedApi.mockReset());

  test('shows deterministic stale-profile blocking on seasonal entry', async () => {
    mockedApi.mockResolvedValue({ cycle: null, currentGoal: { goalType: 'TOTAL_AVAILABLE_CREDIT', scope: 'PERSONAL', targetAmount: '50000', version: 1 }, profileState: { status: 'STALE', updatedAt: '2026-09-01' }, blockers: ['CURRENT_REVIEW_REQUIRED'], canStartOrResume: false, currentRoundId: null });
    wrapper(<SeasonalCyclePage />);
    expect(await screen.findByText(/Stale or incomplete reviews cannot be bypassed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start seasonal cycle' })).toBeDisabled();
  });

  test('renders paid access separately from preparation and future-stage locks', async () => {
    mockedApi.mockResolvedValue(round);
    wrapper(<Routes><Route path="/app/rounds/:roundId" element={<RoundPage />} /></Routes>, '/app/rounds/11111111-1111-4111-8111-111111111111');
    expect(await screen.findByRole('heading', { name: 'Credit Card Round' })).toBeInTheDocument();
    expect(screen.getByText('Entitlement: Consumed')).toBeInTheDocument();
    expect(screen.getByText(/Strategy, scheduling, applications, results/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete preparation' })).toHaveAttribute('href', '/app/plan');
  });

  test('presents all major-credit choices without claiming professional authority', async () => {
    mockedApi.mockResolvedValue(round);
    wrapper(<Routes><Route path="/app/rounds/:roundId/major-check" element={<MajorApplicationCheckPage />} /></Routes>, '/app/rounds/11111111-1111-4111-8111-111111111111/major-check');
    expect(await screen.findByText(/not an automatic stop\/proceed decision/)).toBeInTheDocument();
    for (const label of ['No', 'Yes — Mortgage', 'Yes — Auto', 'Yes — Student', 'Yes — Other major financing', 'Not sure']) expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
  });
});
