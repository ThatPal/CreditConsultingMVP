/** Deterministic reference/test data. Never import from a production entry point or adapter. */
import type {
  CreditExperience,
  CreditValue,
  ReportAccount,
} from '../src/features/credit-center/data';
const reportDate = '2026-09-08';
const basis =
  'Five revolving accounts with reported balances and positive limits; one revolving account excluded because its limit is unavailable.';
const known = (value: number, definition: string, source = basis): CreditValue => ({
  value,
  definition,
  quality: 'KNOWN',
  basis: source,
});
const balances = [2400, 1800, 1600, 1200, 1000];
const limits = [6000, 6000, 8000, 10000, 10000];
const names = [
  'Harbor Rewards',
  'Summit Cash',
  'Meadow Everyday',
  'Northline Travel',
  'Cedar Preferred',
];
const dates = ['2012-03-01', '2016-06-01', '2019-04-01', '2021-07-01', '2024-01-01'];
const accounts: ReportAccount[] = names.map((creditor, i) => ({
  id: `reference-${i}`,
  creditor,
  maskedIdentifier: `••${1200 + i}`,
  type: 'Revolving',
  status: 'Open',
  balance: known(balances[i]!, 'Reported balance'),
  limit: known(limits[i]!, 'Reported limit'),
  openedAt: dates[i]!,
  reportedAt: reportDate,
  paymentStatus: i === 1 ? '30 days late' : 'Current',
  remarks: null,
  paymentHistory: [],
  bureaus: ['Experian', 'Equifax', 'TransUnion'].map((name) => ({
    name,
    balance: known(
      balances[i]! + (i === 0 && name === 'Equifax' ? 120 : 0),
      'Bureau reported balance',
    ),
    limit: known(limits[i]!, 'Bureau reported limit'),
    status: 'Open',
  })),
}));
accounts.push({
  ...accounts[0]!,
  id: 'reference-excluded',
  creditor: 'Riverline Card',
  openedAt: '2023-03-01',
  balance: known(200, 'Reported balance'),
  limit: { value: null, quality: 'UNKNOWN', definition: 'Reported limit' },
  bureaus: [],
});
accounts.push({
  ...accounts[0]!,
  id: 'reference-installment',
  creditor: 'Reference Auto Loan',
  type: 'Installment',
  openedAt: '2020-09-01',
  balance: known(6400, 'Reported balance'),
  bureaus: [],
});
accounts.push({
  ...accounts[0]!,
  id: 'reference-mortgage',
  creditor: 'Reference Home Loan',
  type: 'Mortgage',
  openedAt: '2018-09-01',
  balance: known(210000, 'Reported balance'),
  bureaus: [],
});
const months = accounts.map(
  (a) => (2026 - Number(a.openedAt!.slice(0, 4))) * 12 + 9 - Number(a.openedAt!.slice(5, 7)),
);
export const referenceProfile: CreditExperience = {
  inquiryWindow: 'Reported inquiries · September 9, 2025–September 8, 2026',
  paymentSummary: 'One account reported 30 days late; seven accounts reported current.',
  scores: ['Experian', 'Equifax', 'TransUnion'].map((bureau, i) => ({
    bureau,
    value: [732, 724, 739][i]!,
    model: 'Reference scoring model',
    range: [300, 850],
    date: reportDate,
    factors: i === 0 ? ['Balances on revolving accounts', 'Length of account history'] : [],
  })),
  metrics: {
    aggregateUtilization: known(20, 'Balance / limit across the five eligible revolving accounts'),
    revolvingBalance: known(8000, 'Eligible revolving balance'),
    revolvingLimit: known(40000, 'Eligible revolving limit'),
    openAccounts: known(8, 'Published open-account count', 'Eight reported accounts'),
    closedAccounts: known(0, 'Published closed-account count', 'Eight reported accounts'),
    revolvingAccounts: known(6, 'Published revolving-account count', 'Eight reported accounts'),
    installmentAccounts: known(1, 'Published installment-account count', 'Eight reported accounts'),
    oldestAccountAgeMonths: known(
      Math.max(...months),
      'Oldest age in calendar months as of September 8, 2026',
    ),
    averageAccountAgeMonths: known(
      Math.round(months.reduce((a, b) => a + b, 0) / months.length),
      'Mean completed calendar-month difference from opening month to report month across eight accounts',
    ),
    latePayments: known(1, 'Reported late-payment count'),
    recentInquiries: known(3, 'Reported inquiry count for September 9, 2025–September 8, 2026'),
    derogatoryItems: known(1, 'Published negative-item count'),
    collections: known(1, 'Published collection count'),
  },
  accounts,
  inquiries: [
    { creditor: 'Meadow Bank', bureau: 'Experian', date: '2026-07-12', type: 'Hard inquiry' },
    { creditor: 'Northline Bank', bureau: 'Equifax', date: '2026-04-09', type: 'Hard inquiry' },
    { creditor: 'Harbor Bank', bureau: 'TransUnion', date: '2025-11-18', type: 'Hard inquiry' },
  ],
  negatives: [
    {
      title: 'Reference collection account',
      bureau: 'Experian',
      date: '2026-08-10',
      status: 'Reported unpaid',
    },
  ],
};
