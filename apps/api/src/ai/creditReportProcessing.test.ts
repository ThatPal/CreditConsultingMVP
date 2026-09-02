import { describe, expect, test } from 'vitest';
import { extractReport, staleExtraction, validateSupportedReport } from './creditReportProcessing.js';
import { encryptedReport, malformedReport, supportedThreeBureauReport, unreadableReport, unsupportedReport } from './fixtures/syntheticReports.js';

const source = { reportDocumentId: 'report-a', clientId: 'client-a', sha256: 'sha-a', acceptedReportDate: '2026-08-31', validationStatus: 'ACCEPTED' as const };

describe('credit report validation and factual extraction', () => {
  test('extracts three bureaus with immutable source, bureau identity and direct evidence', () => {
    const output = extractReport(source, supportedThreeBureauReport);
    expect(output.status).toBe('SUCCEEDED');
    expect(output.facts?.scores.map(({ bureau }) => bureau)).toEqual(['EXPERIAN', 'EQUIFAX', 'TRANSUNION']);
    expect(output.facts?.tradelines).toHaveLength(4);
    expect(output.facts?.tradelines.every(({ evidence }) => evidence[0]?.page)).toBe(true);
    expect(output.validation.acceptedReportDate).toBe(source.acceptedReportDate);
    expect(output.exceptions.map(({ key }) => key)).toContain('AMBIGUOUS_exp-secured');
  });
  test.each([[malformedReport, 'INCOMPLETE_STRUCTURE'], [unreadableReport, 'UNREADABLE'], [encryptedReport, 'ENCRYPTED'], [unsupportedReport, 'UNSUPPORTED_FORMAT']] as const)('routes invalid fixture without changing accepted source truth', (report, reason) => {
    const before = structuredClone(source);
    expect(validateSupportedReport(source, report).reasons).toContain(reason);
    expect(extractReport(source, report).status).toBe('FAILED_REVIEW');
    expect(source).toEqual(before);
  });
  test('source replacement makes the immutable old extraction stale', () => {
    const output = extractReport(source, supportedThreeBureauReport);
    if (output.status !== 'SUCCEEDED') throw new Error('fixture failed');
    expect(staleExtraction(output, 'sha-b').stale).toBe(true);
  });
});
