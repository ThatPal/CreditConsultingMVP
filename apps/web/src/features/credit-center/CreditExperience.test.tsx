import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { theme } from '../../theme';
import {
  adaptPublishedProfile,
  comparableScores,
  compareCreditValues,
  type CreditValue,
  type ReportAccount,
} from './data';
import { BureauScoreGallery, CreditDataValue } from './CreditData';
import { ReportAccounts } from './ReportAccounts';
import { HistoricalMetric } from './CreditHistory';
const renderUI = (node: React.ReactNode) =>
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{node}</MemoryRouter>
    </ThemeProvider>,
  );
const known = (value: number): CreditValue => ({
  value,
  quality: 'KNOWN',
  definition: 'Reported balance',
});

test('missing and invalid summaries remain unknown, valid zero is not lost, and legacy coverage is partial', () => {
  const data = adaptPublishedProfile(
    {
      openAccounts: 0,
      revolvingLimit: NaN,
      latePayments: -1,
      experianScore: 720,
      internalNotes: 'not allowed',
    },
    null,
  );
  expect(data.metrics.openAccounts).toMatchObject({ value: 0, quality: 'PARTIAL' });
  expect(data.metrics.revolvingLimit).toMatchObject({ value: null, quality: 'UNKNOWN' });
  expect(data.metrics.latePayments?.value).toBeNull();
  expect(data.accounts).toBeNull();
  expect(data.scores[0]?.model).toBeNull();
  expect(JSON.stringify(data)).not.toContain('internalNotes');
});
test.each(['KNOWN', 'PARTIAL', 'UNKNOWN', 'NOT_APPLICABLE'] as const)(
  'presents %s without inventing data',
  (quality) => {
    renderUI(<CreditDataValue fact={{ ...known(0), quality, basis: 'Two of three accounts' }} />);
    expect(
      screen.getByText(
        quality === 'UNKNOWN'
          ? 'Not available in this report'
          : quality === 'NOT_APPLICABLE'
            ? 'Not applicable'
            : '0',
      ),
    ).toBeInTheDocument();
    if (quality === 'PARTIAL')
      expect(screen.getByText(/Two of three accounts/)).toBeInTheDocument();
  },
);
test('bureau gallery supports buttons and missing-score states without an assumed range', () => {
  renderUI(
    <BureauScoreGallery
      scores={adaptPublishedProfile({ experianScore: 720 }, '2026-09-01').scores}
    />,
  );
  expect(screen.getByText('720')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next bureau' }));
  expect(screen.getByText('Not available in this report')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Equifax' })).toHaveAttribute('aria-pressed', 'true');
});
test('comparisons require matching score identity and complete metric definitions', () => {
  const score = {
    bureau: 'Experian',
    value: 720,
    model: 'Model A',
    date: '2026-09-01',
    range: [300, 850] as [number, number],
    factors: [],
  };
  expect(comparableScores(score, { ...score, value: 730 })).toBe(true);
  expect(comparableScores(score, { ...score, model: 'Model B' })).toBe(false);
  expect(comparableScores({ ...score, range: null }, { ...score, range: null })).toBe(false);
  expect(comparableScores(score, { ...score, date: 'invalid' })).toBe(false);
  expect(comparableScores({ ...score, model: null }, { ...score, model: null })).toBe(false);
  expect(compareCreditValues(known(0), known(2))).toBe(2);
  expect(compareCreditValues({ ...known(0), quality: 'PARTIAL' }, known(2))).toBeNull();
});
test('historical chart leaves missing observations as gaps and exposes exact values', () => {
  const { container } = renderUI(
    <HistoricalMetric
      title="Known balances"
      points={[
        { date: 'Sep 1', value: 100 },
        { date: 'Sep 2', value: null },
        { date: 'Sep 3', value: 200 },
      ]}
    />,
  );
  expect(container.querySelectorAll('svg line')).toHaveLength(0);
  expect(within(screen.getByRole('table')).getByText('Not available')).toBeInTheDocument();
});
test('account gallery, searchable list and detail preserve selection and distinguish zero from unknown', async () => {
  const account: ReportAccount = {
    id: 'a',
    creditor: 'First account',
    maskedIdentifier: '••1234',
    type: 'Revolving',
    status: 'Open',
    balance: known(0),
    limit: { value: null, quality: 'UNKNOWN', definition: 'Limit' },
    openedAt: null,
    reportedAt: '2026-09-01',
    paymentStatus: null,
    remarks: null,
    bureaus: [],
    paymentHistory: [],
  };
  renderUI(
    <ReportAccounts accounts={[account, { ...account, id: 'b', creditor: 'Second account' }]} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next account' }));
  expect(screen.getByText('2 of 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open account detail' }));
  const dialog = await screen.findByRole('dialog', { name: 'Second account' });
  expect(within(dialog).getByText('$0')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close account detail' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('2 of 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View all accounts' }));
  fireEvent.change(screen.getByLabelText('Find an account'), { target: { value: 'First' } });
  expect(screen.getByRole('button', { name: /First account/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Second account/ })).not.toBeInTheDocument();
});
