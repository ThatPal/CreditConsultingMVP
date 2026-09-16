/** Read-only experience adapter. U3 owns structured report publication, not this module. */
export type Quality = 'KNOWN' | 'PARTIAL' | 'UNKNOWN' | 'NOT_APPLICABLE';
/** Report dates represent a calendar day, not the viewer's local midnight. */
export function formatReportDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return 'Date not supplied';
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { timeZone: 'UTC' })
    : 'Date not supplied';
}
export type CreditValue = {
  value: number | null;
  quality: Quality;
  basis?: string;
  definition: string;
};
export type ScoreFact = {
  bureau: string;
  value: number | null;
  model: string | null;
  date: string | null;
  range: [number, number] | null;
  factors: string[];
};
export type ReportAccount = {
  id: string;
  creditor: string;
  maskedIdentifier: string | null;
  type: string | null;
  status: string | null;
  balance: CreditValue;
  limit: CreditValue;
  openedAt: string | null;
  reportedAt: string | null;
  paymentStatus: string | null;
  remarks: string | null;
  bureaus: Array<{ name: string; balance: CreditValue; limit: CreditValue; status: string | null }>;
  paymentHistory: Array<{ month: string; status: string }>;
  cardHref?: string;
};
export type CreditExperience = {
  scores: ScoreFact[];
  metrics: Record<string, CreditValue>;
  accounts: ReportAccount[] | null;
  inquiries: Array<{ creditor: string; bureau: string; date: string; type: string | null }> | null;
  negatives: Array<{
    title: string;
    bureau: string;
    date: string | null;
    status: string | null;
  }> | null;
};
export const unknownValue = (definition: string): CreditValue => ({
  value: null,
  quality: 'UNKNOWN',
  definition,
});
export const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const definitions: Record<string, string> = {
  revolvingBalance: 'Published revolving balance',
  revolvingLimit: 'Published revolving limit',
  aggregateUtilization: 'Published aggregate utilization',
  openAccounts: 'Published open-account count',
  recentInquiries: 'Published inquiry count; date window not supplied',
  derogatoryItems: 'Published negative-item count',
  averageAccountAgeMonths:
    'Published average account age in months; included accounts not supplied',
  oldestAccountAgeMonths: 'Published oldest account age in months',
  revolvingAccounts: 'Published revolving-account count',
  installmentAccounts: 'Published installment-account count',
  closedAccounts: 'Published closed-account count',
  latePayments: 'Published late-payment count',
  collections: 'Published collection count',
};
export function adaptPublishedProfile(
  profile: Record<string, unknown>,
  reportDate: string | null,
): CreditExperience {
  return {
    scores: (
      [
        ['experianScore', 'Experian'],
        ['equifaxScore', 'Equifax'],
        ['transunionScore', 'TransUnion'],
      ] as const
    ).map(([key, bureau]) => ({
      bureau,
      value: finiteNumber(profile[key]),
      model: null,
      date: reportDate,
      range: null,
      factors: [],
    })),
    metrics: Object.fromEntries(
      Object.entries(definitions).map(([key, definition]) => {
        const value = finiteNumber(profile[key]);
        return [
          key,
          value === null
            ? unknownValue(definition)
            : ({
                value,
                quality: 'PARTIAL',
                definition,
                basis:
                  'Published summary. Included accounts and calculation coverage were not supplied.',
              } satisfies CreditValue),
        ];
      }),
    ),
    accounts: null,
    inquiries: null,
    negatives: null,
  };
}
export function comparableScores(a: ScoreFact, b: ScoreFact) {
  return (
    a.value !== null &&
    b.value !== null &&
    Number.isFinite(a.value) &&
    Number.isFinite(b.value) &&
    Boolean(a.model && b.model && a.date && b.date) &&
    Boolean(a.range && b.range) &&
    Number.isFinite(Date.parse(a.date ?? '')) &&
    Number.isFinite(Date.parse(b.date ?? '')) &&
    a.bureau === b.bureau &&
    a.model === b.model &&
    JSON.stringify(a.range) === JSON.stringify(b.range)
  );
}
export function compareCreditValues(a: CreditValue, b: CreditValue) {
  return a.quality === 'KNOWN' &&
    b.quality === 'KNOWN' &&
    a.definition === b.definition &&
    a.value !== null &&
    b.value !== null
    ? b.value - a.value
    : null;
}
