export type ReportValidationResult = {
  status: 'VALIDATED' | 'NEEDS_STAFF_REVIEW' | 'REJECTED';
  rejectionCode: string | null;
  rejectionReason: string | null;
};

const day = (value: Date) => value.toISOString().slice(0, 10);

export function validateCreditReportUpload(input: {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
  enteredReportDate: Date;
  intendedReportDate: Date;
  latestAcceptedReportDate: Date | null;
}): ReportValidationResult {
  if (input.mimeType !== 'application/pdf' || !input.fileName.toLowerCase().endsWith('.pdf'))
    return {
      status: 'REJECTED',
      rejectionCode: 'WRONG_FILE_TYPE',
      rejectionReason: 'Upload a PDF credit report.',
    };
  if (!input.bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
    return {
      status: 'REJECTED',
      rejectionCode: 'INVALID_PDF_SIGNATURE',
      rejectionReason: 'The file is not a readable PDF.',
    };
  const text = input.bytes.toString('latin1');
  if (text.includes('/Encrypt'))
    return {
      status: 'REJECTED',
      rejectionCode: 'ENCRYPTED_PDF',
      rejectionReason: 'Remove the PDF password or encryption and upload it again.',
    };
  if (!text.includes('%%EOF'))
    return {
      status: 'REJECTED',
      rejectionCode: 'UNREADABLE_PDF',
      rejectionReason: 'The PDF appears incomplete or unreadable.',
    };
  if (input.latestAcceptedReportDate && input.enteredReportDate <= input.latestAcceptedReportDate)
    return {
      status: 'REJECTED',
      rejectionCode: 'REPORT_NOT_NEWER',
      rejectionReason: `Use a report newer than ${day(input.latestAcceptedReportDate)}.`,
    };
  if (day(input.enteredReportDate) !== day(input.intendedReportDate))
    return {
      status: 'NEEDS_STAFF_REVIEW',
      rejectionCode: 'REPORT_DATE_DISCREPANCY',
      rejectionReason: `The entered report date differs from the intended date ${day(input.intendedReportDate)}.`,
    };
  return { status: 'VALIDATED', rejectionCode: null, rejectionReason: null };
}
