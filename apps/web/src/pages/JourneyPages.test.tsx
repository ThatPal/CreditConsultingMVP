import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { theme } from '../theme';
import { JourneySummary, type JourneyProjection } from './JourneyPages';

const projection: JourneyProjection = {
  client: { id: 'client-1', firstName: 'Jordan', lastName: 'Blake' },
  goal: { goalType: 'TOTAL_AVAILABLE_CREDIT', scope: 'PERSONAL', targetAmount: 50000 },
  journey: {
    id: 'journey-1',
    status: 'ACTIVE',
    startedAt: '2026-08-01T00:00:00Z',
    currentFocus: {
      code: 'PLAN',
      title: 'Complete your Plan action',
      detail: 'Report the factual balance change for consultant verification.',
      action: '/app/plan',
    },
    cycles: [],
    nurturePeriods: [],
  },
  foundations: {
    creditProfile: { status: 'CURRENT', effectiveAt: '2026-09-01T00:00:00Z' },
    plan: { status: 'AVAILABLE', openActionCount: 2 },
    appointment: { status: 'NOT_SCHEDULED' },
  },
};

describe('POAR D2 client financial journey', () => {
  test('projects one truthful current action and an accessible lifecycle', () => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <JourneySummary data={projection} showHistory={false} />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole('link', { name: /view next step/i })).toHaveAttribute(
      'href',
      '/app/plan',
    );
    expect(screen.getByText('Desired credit amount')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByLabelText('Your financial journey')).toBeInTheDocument();
    expect(screen.queryByText(/approval probability|score improvement/i)).not.toBeInTheDocument();
  });
});

test.each(['NOT_AVAILABLE', 'NOT_SCHEDULED', 'CANCELLED', 'COMPLETED'])(
  'does not fill Home with an empty or inactive appointment: %s',
  (status) => {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <JourneySummary
            data={{
              ...projection,
              foundations: { ...projection.foundations, appointment: { status } },
            }}
            showHistory={false}
          />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.queryByText('Upcoming appointment')).not.toBeInTheDocument();
    expect(screen.queryByText('Not scheduled')).not.toBeInTheDocument();
  },
);
test('shows the booked time with its timezone and owning round destination', () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <JourneySummary
          data={{
            ...projection,
            foundations: {
              ...projection.foundations,
              appointment: {
                status: 'BOOKED',
                startsAt: '2026-09-20T16:00:00Z',
                timezone: 'America/New_York',
                roundId: 'round-1',
              },
            },
          }}
          showHistory={false}
        />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByText('Upcoming appointment')).toBeInTheDocument();
  expect(screen.getByText('Sep 20')).toBeInTheDocument();
  expect(screen.getByText('12:00 PM EDT')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View appointment' })).toHaveAttribute(
    'href',
    '/app/rounds/round-1/schedule',
  );
});
