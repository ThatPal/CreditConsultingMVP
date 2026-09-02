import { ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { apiRequest } from '../auth/api';
import { theme } from '../theme';
import { JourneySummary, type JourneyProjection } from './JourneyPages';
import { ConsultantReviewsPage } from './ReviewPages';

vi.mock('../auth/api', () => ({ apiRequest: vi.fn() }));
const mockedApi = vi.mocked(apiRequest);

function renderPage(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <MemoryRouter>{element}</MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const journey: JourneyProjection = {
  client: { id: 'client', firstName: 'Jordan', lastName: 'Blake' },
  goal: null,
  journey: {
    id: 'journey',
    status: 'ACTIVE',
    startedAt: '2026-01-01T00:00:00.000Z',
    currentFocus: {
      code: 'REVIEW',
      title: 'Complete your review',
      detail: null,
      action: '/app/credit-center/review',
    },
    cycles: [
      {
        id: 'cycle',
        cycleNumber: 1,
        displayName: 'Current cycle',
        status: 'ACTIVE',
        currentStage: 'CREDIT_REVIEW',
        startedAt: '2026-01-01T00:00:00.000Z',
        closedAt: null,
        finalResult: null,
        timelineGroup: 'CURRENT',
        goalSnapshot: null,
      },
    ],
    nurturePeriods: [],
  },
  foundations: {
    creditProfile: { status: 'IN_PROGRESS' },
    plan: { status: 'NOT_AVAILABLE', openActionCount: 0 },
    appointment: { status: 'NOT_AVAILABLE' },
  },
};

describe('Phase 4–5 visual maturity regressions', () => {
  beforeEach(() => mockedApi.mockReset());

  test('keeps the client home concise while the Journey route owns timeline history', () => {
    const { rerender } = renderPage(<JourneySummary data={journey} showHistory={false} />);
    expect(screen.queryByRole('heading', { name: 'Current cycle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Journey history' })).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <JourneySummary data={journey} />
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Current cycle' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Journey history' })).toBeInTheDocument();
  });

  test('opens consultant Reviews inside the canonical CRM shell route', async () => {
    mockedApi.mockResolvedValue({
      reviews: [
        {
          id: 'review',
          clientId: 'client',
          status: 'INFORMATION_RECEIVED',
          submittedAt: '2026-01-01T00:00:00.000Z',
          client: { firstName: 'Jordan', lastName: 'Blake' },
        },
      ],
    });
    renderPage(<ConsultantReviewsPage />);
    expect(await screen.findByRole('link', { name: 'Open guided Review' })).toHaveAttribute(
      'href',
      '/crm/clients/client/reviews/review',
    );
  });
});
