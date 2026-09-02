import { describe, expect, test } from 'vitest';
import { validateCreditReportUpload } from './reportValidation.js';

const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
const base = {
  bytes: pdf,
  mimeType: 'application/pdf',
  fileName: 'report.pdf',
  enteredReportDate: new Date('2026-08-01T00:00:00Z'),
  intendedReportDate: new Date('2026-08-01T00:00:00Z'),
  latestAcceptedReportDate: new Date('2026-07-01T00:00:00Z'),
};

describe('credit report validation state machine', () => {
  test('validates a readable newer PDF', () => {
    expect(validateCreditReportUpload(base)).toEqual({
      status: 'VALIDATED',
      rejectionCode: null,
      rejectionReason: null,
    });
  });

  test.each([
    [{ ...base, mimeType: 'text/plain' }, 'WRONG_FILE_TYPE'],
    [{ ...base, bytes: Buffer.from('not a pdf') }, 'INVALID_PDF_SIGNATURE'],
    [{ ...base, bytes: Buffer.from('%PDF-1.7 /Encrypt %%EOF') }, 'ENCRYPTED_PDF'],
    [{ ...base, bytes: Buffer.from('%PDF-1.7 without trailer') }, 'UNREADABLE_PDF'],
    [{ ...base, enteredReportDate: new Date('2026-07-01T00:00:00Z') }, 'REPORT_NOT_NEWER'],
  ])('rejects invalid and non-authoritative report input', (input, code) => {
    expect(validateCreditReportUpload(input).rejectionCode).toBe(code);
  });

  test('routes an intended/entered date discrepancy to staff review', () => {
    expect(
      validateCreditReportUpload({
        ...base,
        enteredReportDate: new Date('2026-08-02T00:00:00Z'),
      }),
    ).toMatchObject({
      status: 'NEEDS_STAFF_REVIEW',
      rejectionCode: 'REPORT_DATE_DISCREPANCY',
    });
  });
});
