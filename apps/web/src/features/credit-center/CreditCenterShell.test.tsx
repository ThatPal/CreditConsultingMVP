import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { theme } from '../../theme';
import { CreditCenterHeader, CreditCenterShell } from './CreditCenterShell';
import { apiRequest } from '../../auth/api';

vi.mock('../../auth/api', () => ({ apiRequest: vi.fn() }));
const current = {
  id: 'current',
  reviewId: 'review-1',
  publishedAt: '2026-09-09T12:00:00Z',
  report: { reportDate: '2026-09-08' },
};
const prior = {
  ...current,
  id: 'older',
  reviewId: 'review-0',
  publishedAt: '2026-08-09T12:00:00Z',
};
const show = (node: React.ReactNode, path = '/app/credit-center') =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </ThemeProvider>,
  );

test('one publication displays truthful context without a misleading Review dropdown', () => {
  show(<CreditCenterHeader area="overview" data={{ current, history: [current] }} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Credit Center' })).toBeVisible();
  expect(screen.getByLabelText(/Viewing Current/)).toHaveTextContent('Current Review');
  expect(screen.queryByRole('button', { name: /Viewing/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Based on report/)).not.toBeInTheDocument();
});

test('prior Reviews do not produce disabled choices or a misleading dropdown', () => {
  show(<CreditCenterHeader area="analysis" data={{ current, history: [prior, current] }} />);
  expect(screen.getByLabelText('Viewing Current Review')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Viewing/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  expect(screen.queryByText('Previous reviews')).not.toBeInTheDocument();
});

test('older publications of the current Review are not separate Review choices', () => {
  show(
    <CreditCenterHeader
      area="overview"
      data={{ current, history: [current, { ...prior, reviewId: current.reviewId }] }}
    />,
  );
  expect(screen.queryByRole('button', { name: /Viewing/ })).not.toBeInTheDocument();
});

test('unavailable context is not described as an empty publication history', () => {
  show(<CreditCenterHeader area="overview" />);
  expect(screen.getByLabelText('Viewing Assessment unavailable')).toBeVisible();
  expect(screen.queryByText('No published assessment')).not.toBeInTheDocument();
});

test('an unknown Review link does not borrow the current publication metadata', () => {
  show(
    <CreditCenterHeader area="plan" data={{ current, history: [current] }} />,
    '/app/credit-center/plan?review=missing',
  );
  expect(screen.getByLabelText('Viewing Assessment unavailable')).toBeVisible();
  expect(screen.queryByText(/Based on report/)).not.toBeInTheDocument();
});

test.each(['overview', 'profile', 'report', 'analysis', 'plan', 'history'] as const)(
  'historical %s shell retains the area and only truthful metadata',
  (area) => {
    const path = '/app/credit-center' + (area === 'overview' ? '' : '/' + area);
    show(
      <CreditCenterHeader area={area} data={{ current, history: [current, prior] }} />,
      path + '?review=older',
    );
    expect(screen.getByRole('region', { name: 'Historical review context' })).toHaveTextContent(
      '8/9/2026',
    );
    expect(screen.getByRole('link', { name: 'Return to current' })).toHaveAttribute('href', path);
  },
);

test('historical direct Plan links never render current consequential actions', async () => {
  vi.mocked(apiRequest).mockResolvedValue({ current, history: [current, prior] });
  show(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Routes>
        <Route element={<CreditCenterShell />}>
          <Route path="/app/plan" element={<button>Submit current Plan</button>} />
        </Route>
      </Routes>
    </QueryClientProvider>,
    '/app/plan?review=older',
  );
  expect(await screen.findByText('Historical view · 8/9/2026')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Submit current Plan' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Return to current' }));
  expect(await screen.findByRole('button', { name: 'Submit current Plan' })).toBeVisible();
});
