import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { ClientStrategyPage, ConsultantStrategyPage } from './StrategyPages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);
const renderRoute = (element: React.ReactNode, path: string, pattern: string) =>
  render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={pattern} element={element} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );

describe('Strategy application surfaces', () => {
  beforeEach(() => mockedApi.mockReset());

  test('hides stale approved guidance from the client', async () => {
    mockedApi.mockResolvedValue({
      strategy: { id: 's', roundId: 'r', status: 'STALE' },
      approved: null,
      stale: true,
      historical: { version: 2, approvedAt: '2026-09-03' },
    });
    renderRoute(<ClientStrategyPage />, '/app/rounds/r/strategy', '/app/rounds/:roundId/strategy');
    expect(await screen.findByText(/Outdated application guidance is hidden/)).toBeInTheDocument();
    expect(screen.queryByText(/timingRule|stopRule|internalRationale/)).not.toBeInTheDocument();
  });

  test('renders sustained consultant context, comparison, authoring, validation, and confirmation controls', async () => {
    mockedApi.mockImplementation(async (url) =>
      String(url).includes('/strategy/catalog')
        ? {
            products: [
              {
                id: 'p1',
                displayName: 'Current Card',
                audience: 'PERSONAL',
                portfolioType: 'PERSONAL_CREDIT',
                secured: false,
                issuer: { name: 'Issuer One' },
                currentOfferVersion: { id: 'o1', version: 2, status: 'CURRENT', fresh: true },
                currentInsightVersion: {
                  id: 'i1',
                  clientSafeSummary: 'Useful current governed context.',
                },
              },
              {
                id: 'p2',
                displayName: 'Backup Card',
                audience: 'PERSONAL',
                portfolioType: 'PERSONAL_CREDIT',
                secured: true,
                issuer: { name: 'Issuer Two' },
                currentOfferVersion: { id: 'o2', version: 1, status: 'CURRENT', fresh: true },
                currentInsightVersion: null,
              },
            ],
          }
        : ({
            strategy: { id: 's', roundId: 'r', status: 'READY_FOR_APPROVAL', version: 4 },
            current: {
              id: 'v',
              version: 1,
              status: 'READY_FOR_APPROVAL',
              sourceContext: { plan: { status: 'ACTIVE' } },
              brief: { status: 'AI_PREPARED' },
              aiProposal: { authority: 'PROPOSAL_ONLY', themes: ['Protect profile'] },
              validation: { valid: true, errors: [] },
              candidates: [
                {
                  id: 'c1',
                  productId: 'p1',
                  disposition: 'SHORTLISTED',
                  role: 'PLANNED',
                  internalRationale: 'Professional rationale',
                  clientSafeReason: 'Supports your goal',
                },
              ],
              applications: [
                {
                  candidateId: 'c1',
                  sequence: 1,
                  role: 'PLANNED',
                  internalRationale: 'Professional rationale',
                  clientSafeReason: 'Supports your goal',
                  timingRule: { instruction: 'Confirm offer' },
                  stopRule: {},
                },
              ],
            },
            approved: null,
          } as never),
    );
    renderRoute(
      <ConsultantStrategyPage />,
      '/crm/clients/client/rounds/r/strategy',
      '/crm/clients/:clientId/rounds/:roundId/strategy',
    );
    expect(await screen.findByRole('heading', { name: 'Source context' })).toBeInTheDocument();
    expect(screen.getByText(/Proposal only/)).toBeInTheDocument();
    expect(screen.getByLabelText('Search issuer or product')).toBeInTheDocument();
    expect(screen.getByText('Shortlist decisions')).toBeInTheDocument();
    expect(screen.getByLabelText('Client-safe ‘Why this card?’')).toBeInTheDocument();
    expect(screen.getByText('Deterministic sequence validation passed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review approval' })).toBeEnabled();
  });
});
