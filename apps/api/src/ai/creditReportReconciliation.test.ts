import { describe, expect, test } from 'vitest';
import { extractReport } from './creditReportProcessing.js';
import { supportedThreeBureauReport } from './fixtures/syntheticReports.js';
import { buildReconciledDraft, normalizeTradelines, reconcileAccounts, staleDraft } from './creditReportReconciliation.js';

const source = { reportDocumentId: 'report-a', clientId: 'client-a', sha256: 'sha-a', acceptedReportDate: '2026-08-31', validationStatus: 'ACCEPTED' as const };
const extraction = extractReport(source, supportedThreeBureauReport);
if (extraction.status !== 'SUCCEEDED' || !extraction.facts) throw new Error('invalid fixture');
const cards = [
  { id: 'card-1', issuer: 'Example Bank', cardName: 'Everyday', maskedIdentifier: '4242', portfolioType: 'PERSONAL_CREDIT' as const, reportsToBureaus: true },
  { id: 'card-business', issuer: 'Business Bank', cardName: 'Business Cash', maskedIdentifier: '9999', portfolioType: 'NON_REPORTING' as const, reportsToBureaus: false },
];

describe('normalization, reconciliation and card matching', () => {
  test('known labels normalize while raw values and evidence remain', () => {
    const normalized = normalizeTradelines(extraction.facts.tradelines);
    expect(normalized[0]?.normalized.accountType).toBe('REVOLVING');
    expect(normalized[0]?.raw.accountType).toBe('Revolving');
    expect(normalized[0]?.evidence[0]?.page).toBe(4);
  });
  test('three bureau representations group once and preserve differences', () => {
    const draft = buildReconciledDraft({ extraction, cards, artifactVersion: 1 });
    const repeated = draft.logicalAccounts.find(({ sources }) => sources.length === 3);
    expect(repeated?.bureaus).toEqual(['EXPERIAN', 'EQUIFAX', 'TRANSUNION']);
    expect(repeated?.differingFields).toEqual(expect.arrayContaining(['balance', 'limit']));
    expect(draft.exceptions.some(({ key }) => key.startsWith('BUREAU_CONFLICT'))).toBe(true);
    expect(draft.cardMatches.matches.find(({ logicalAccountId }) => logicalAccountId === repeated?.logicalAccountId)?.clientCardId).toBe('card-1');
    expect(draft.cardMatches.portfolioOnly.find(({ id }) => id === 'card-business')?.reportPresence).toBe(false);
  });
  test('ambiguous account does not force merge and unresolved identity is explicit', () => {
    const ambiguous = normalizeTradelines([{ ...extraction.facts.tradelines[0]!, candidateId: 'ambiguous', maskedSuffix: undefined, accountType: 'Novel Account' }]);
    const result = reconcileAccounts(ambiguous);
    expect(result.logicalAccounts).toHaveLength(1);
    expect(result.exceptions[0]?.key).toBe('AMBIGUOUS_GROUP_ambiguous');
  });
  test('upstream replacement stales the derived version without mutation', () => {
    const draft = buildReconciledDraft({ extraction, cards, artifactVersion: 1 });
    expect(staleDraft(draft, 'sha-b').current).toBe(false);
    expect(draft.current).toBe(true);
  });
  test('replay is deterministic and creates no duplicate logical accounts or exceptions', () => {
    const first = buildReconciledDraft({ extraction, cards, artifactVersion: 1 });
    const replay = buildReconciledDraft({ extraction, cards, artifactVersion: 1 });
    expect(replay).toEqual(first);
    expect(new Set(first.logicalAccounts.map(({ logicalAccountId }) => logicalAccountId)).size).toBe(first.logicalAccounts.length);
    expect(new Set(first.exceptions.map(({ key }) => key)).size).toBe(first.exceptions.length);
  });
});
