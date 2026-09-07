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
    expect(
      screen.getByRole('link', { name: /continue complete your plan action/i }),
    ).toHaveAttribute('href', '/app/plan');
    expect(screen.getByText(/factual target \$50,000/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Your financial journey')).toBeInTheDocument();
    expect(screen.queryByText(/approval probability|score improvement/i)).not.toBeInTheDocument();
  });
});
