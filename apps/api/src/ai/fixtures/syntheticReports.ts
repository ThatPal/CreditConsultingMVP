import type { SyntheticReport } from '../creditReportProcessing.js';

export const supportedThreeBureauReport: SyntheticReport = {
  format: 'SYNTHETIC_3_BUREAU_V1', readable: true, complete: true,
  reportDateCandidates: ['2026-08-31'],
  scores: [
    { bureau: 'EXPERIAN', score: 721, page: 1 }, { bureau: 'EQUIFAX', score: 708, page: 2 },
    { bureau: 'TRANSUNION', score: 715, page: 3 },
  ],
  tradelines: [
    { candidateId: 'exp-revolve-1', bureau: 'EXPERIAN', issuer: 'Example Bank', maskedSuffix: '4242', accountType: 'Revolving', status: 'Open', balance: 1200, limit: 5000, openedOn: '2020-01-15', page: 4 },
    { candidateId: 'eq-revolve-1', bureau: 'EQUIFAX', issuer: 'EXAMPLE BK', maskedSuffix: '4242', accountType: 'Credit Card', status: 'Open', balance: 1250, limit: 5000, openedOn: '2020-01-15', page: 5 },
    { candidateId: 'tu-revolve-1', bureau: 'TRANSUNION', issuer: 'Example Bank NA', maskedSuffix: '4242', accountType: 'Revolving Account', status: 'Open', balance: 1200, limit: 4900, openedOn: '2020-01-15', page: 6 },
    { candidateId: 'exp-secured', bureau: 'EXPERIAN', issuer: 'Safe Bank', maskedSuffix: '1010', accountType: 'Secured Card', status: 'Open', balance: 100, limit: 500, page: 7, confidence: 'low' },
  ],
  inquiries: [{ bureau: 'EXPERIAN', creditor: 'Example Bank', date: '2026-08-01', page: 8 }],
  negativeItems: [{ bureau: 'EQUIFAX', kind: 'LATE_PAYMENT', date: '2025-11-01', page: 9 }],
};
export const malformedReport = { ...supportedThreeBureauReport, complete: false };
export const unreadableReport = { ...supportedThreeBureauReport, readable: false };
export const encryptedReport = { ...supportedThreeBureauReport, encrypted: true };
export const unsupportedReport = { ...supportedThreeBureauReport, format: 'UNKNOWN' };
