import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { CreditProfile } from './CreditProfile';
import { adaptPublishedProfile, type CreditValue, type ReportAccount } from './data';
import { eligibleUtilization, profileCapacity, ProfileUtilization } from './ProfileUtilization';
const known = (value: number): CreditValue => ({
  value,
  quality: 'KNOWN',
  definition: 'Source fact',
  basis: 'Same published account set',
});
const data = () =>
  adaptPublishedProfile(
    { experianScore: 720, equifaxScore: 710, openAccounts: 0, revolvingBalance: 2500 },
    '2026-09-01',
  );
const renderProfile = (hash = '') =>
  render(
    <MemoryRouter initialEntries={['/app/credit-center/profile' + hash]}>
      <CreditProfile data={data()} reportDate="2026-09-01" publishedAt="2026-09-02" />
    </MemoryRouter>,
  );
test('one selected score responds to arrow keys without inventing model, range or grades', () => {
  renderProfile();
  const gallery = screen.getByRole('region', { name: 'Bureau scores' });
  expect(within(gallery).getByText('720')).toBeInTheDocument();
  expect(within(gallery).queryByText('710')).not.toBeInTheDocument();
  fireEvent.keyDown(within(gallery).getByRole('button', { name: 'Experian' }), {
    key: 'ArrowRight',
  });
  expect(within(gallery).getByText('710')).toBeInTheDocument();
  expect(within(gallery).queryByRole('img')).not.toBeInTheDocument();
  expect(screen.queryByText(/Very Good|FICO|healthy range/)).not.toBeInTheDocument();
});
test('collapsed summaries expose supplied zero and missing data distinctly; disclosures remain independent', () => {
  renderProfile();
  const account = screen.getByRole('button', { name: /Accounts & credit mix/ });
  expect(within(account).getByText('0')).toBeInTheDocument();
  expect(within(account).getAllByText('Not available')).toHaveLength(2);
  fireEvent.click(account);
  fireEvent.click(screen.getByRole('button', { name: /Account age & timing/ }));
  expect(account).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: /Account age & timing/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});
test('deep link opens and focuses the exact disclosure', async () => {
  renderProfile('#payment');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Payment history/ })).toHaveFocus(),
  );
  expect(screen.getByRole('button', { name: /Payment history/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
});
test('capacity requires matching known coverage; unknown/zero denominator cannot create account utilization', () => {
  const model = data();
  expect(profileCapacity(model).value).toBeNull();
  model.metrics.revolvingBalance = known(2500);
  model.metrics.revolvingLimit = known(5000);
  expect(profileCapacity(model).value).toBe(2500);
  model.metrics.revolvingLimit = { ...known(5000), basis: 'Different account set' };
  expect(profileCapacity(model).value).toBeNull();
  const account: ReportAccount = {
    id: 'a',
    creditor: 'Source creditor',
    maskedIdentifier: null,
    type: 'Revolving',
    status: null,
    balance: known(100),
    limit: known(0),
    openedAt: null,
    reportedAt: null,
    paymentStatus: null,
    remarks: null,
    bureaus: [],
    paymentHistory: [],
  };
  model.accounts = [
    account,
    { ...account, id: 'b', limit: { ...known(100), quality: 'UNKNOWN' } },
    { ...account, id: 'c', limit: known(200) },
  ];
  expect(eligibleUtilization(model).rows.map((r) => r.percent)).toEqual([50]);
  expect(eligibleUtilization(model).excluded).toBe(2);
});
test('utilization is unavailable with missing aggregate and denominator, never a synthetic zero ring', () => {
  render(
    <MemoryRouter>
      <ProfileUtilization data={data()} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(
    screen.getByText(/Included and excluded account counts are unavailable/),
  ).toBeInTheDocument();
});
test('source factors appear only when supplied, preserve attribution, and internal fields are discarded', () => {
  const model = adaptPublishedProfile(
    { internalNotes: 'SECRET', extractionConfidence: 'SECRET' },
    null,
  );
  model.scores[0]!.factors = ['Source factor wording'];
  render(
    <MemoryRouter>
      <CreditProfile data={model} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Factors included with your score/ }));
  expect(screen.getByText('Source factor wording')).toBeVisible();
  expect(screen.getByText(/Experian · Model not supplied/)).toBeVisible();
  expect(screen.queryByText('SECRET')).not.toBeInTheDocument();
});
