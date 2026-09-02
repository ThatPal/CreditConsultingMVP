import type { AIException, Evidence } from './runtime.js';

export const REPORT_PROCESS_VERSIONS = {
  validate: { key: 'credit_report.validate', version: 1, schema: 1 },
  extract: { key: 'credit_report.extract', version: 1, schema: 1 },
} as const;

export type SyntheticTradeline = {
  candidateId: string;
  bureau: 'EXPERIAN' | 'EQUIFAX' | 'TRANSUNION';
  issuer: string;
  maskedSuffix?: string;
  accountType: string;
  status: string;
  balance?: number;
  limit?: number;
  openedOn?: string;
  page: number;
  confidence?: 'high' | 'medium' | 'low';
};
export type SyntheticReport = {
  format: string;
  readable: boolean;
  encrypted?: boolean;
  complete: boolean;
  reportDateCandidates: string[];
  scores: Array<{ bureau: SyntheticTradeline['bureau']; score: number; page: number }>;
  tradelines: SyntheticTradeline[];
  inquiries: Array<{
    bureau: SyntheticTradeline['bureau'];
    creditor: string;
    date: string;
    page: number;
  }>;
  negativeItems: Array<{
    bureau: SyntheticTradeline['bureau'];
    kind: string;
    date: string;
    page: number;
  }>;
};
export type ReportSource = {
  reportDocumentId: string;
  clientId: string;
  sha256: string;
  acceptedReportDate: string;
  validationStatus: 'ACCEPTED';
};

const fixtureMarker = 'CREDIT_SYNTHETIC_3_BUREAU_V1\n';

/** Narrow, explicit adapter for the supported synthetic acceptance source. */
export function parseSupportedReportBytes(bytes: Buffer): SyntheticReport {
  const text = bytes.toString('utf8');
  const marker = text.indexOf(fixtureMarker);
  if (marker < 0) return unsupportedReport('UNSUPPORTED_UPLOADED_SOURCE');
  try {
    const payload = text
      .slice(marker + fixtureMarker.length)
      .split('\n%%EOF', 1)[0]!
      .trim();
    const parsed = JSON.parse(payload) as SyntheticReport;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.scores) ||
      !Array.isArray(parsed.tradelines) ||
      !Array.isArray(parsed.inquiries) ||
      !Array.isArray(parsed.negativeItems) ||
      !Array.isArray(parsed.reportDateCandidates)
    )
      return unsupportedReport('MALFORMED_UPLOADED_SOURCE');
    return parsed;
  } catch {
    return unsupportedReport('MALFORMED_UPLOADED_SOURCE');
  }
}

function unsupportedReport(format: string): SyntheticReport {
  return {
    format,
    readable: false,
    complete: false,
    reportDateCandidates: [],
    scores: [],
    tradelines: [],
    inquiries: [],
    negativeItems: [],
  };
}

const evidence = (bureau: string, page: number, label: string): Evidence => ({
  kind: 'direct_source',
  source: bureau,
  page,
  label,
});
const exception = (key: string, summary: string, evidenceItems: Evidence[] = []): AIException => ({
  key,
  category: 'REPORT_EXTRACTION',
  summary,
  materiality: 'material',
  confidence: 'low',
  evidence: evidenceItems,
  suggestedResolution: 'Consultant review required',
  humanReviewRequired: true,
  blockingBehavior: 'review',
});

export function validateSupportedReport(source: ReportSource, report: SyntheticReport) {
  const reasons: string[] = [];
  if (report.encrypted) reasons.push('ENCRYPTED');
  if (!report.readable) reasons.push('UNREADABLE');
  if (report.format !== 'SYNTHETIC_3_BUREAU_V1') reasons.push('UNSUPPORTED_FORMAT');
  if (!report.complete) reasons.push('INCOMPLETE_STRUCTURE');
  const bureauCount = new Set(report.scores.map(({ bureau }) => bureau)).size;
  if (bureauCount !== 3) reasons.push('THREE_BUREAU_STRUCTURE_MISSING');
  if (report.reportDateCandidates.length !== 1) reasons.push('AMBIGUOUS_REPORT_DATE');
  return {
    supported: reasons.length === 0,
    reasons,
    acceptedReportDate: source.acceptedReportDate,
    detectedReportDate:
      report.reportDateCandidates.length === 1 ? report.reportDateCandidates[0] : null,
    sourceVersion: source.sha256,
    sourceUnchanged: source.validationStatus === 'ACCEPTED',
  };
}

export function extractReport(source: ReportSource, report: SyntheticReport) {
  const validation = validateSupportedReport(source, report);
  if (!validation.supported)
    return {
      status: 'FAILED_REVIEW' as const,
      validation,
      facts: null,
      exceptions: validation.reasons.map((reason) =>
        exception(reason, reason.replaceAll('_', ' ')),
      ),
    };

  const exceptions: AIException[] = [];
  const tradelines = report.tradelines.map((line) => {
    const directEvidence = evidence(line.bureau, line.page, `tradeline:${line.candidateId}`);
    if ((line.confidence ?? 'high') === 'low')
      exceptions.push(
        exception(`AMBIGUOUS_${line.candidateId}`, 'Material tradeline field is ambiguous', [
          directEvidence,
        ]),
      );
    return {
      ...line,
      confidence: line.confidence ?? 'high',
      evidence: [directEvidence],
      rawValuePreserved: true,
    };
  });
  return {
    status: 'SUCCEEDED' as const,
    validation,
    facts: {
      metadata: {
        detectedReportDate: validation.detectedReportDate,
        acceptedReportDate: source.acceptedReportDate,
      },
      scores: report.scores.map((score) => ({
        ...score,
        evidence: [evidence(score.bureau, score.page, 'credit-score')],
      })),
      tradelines,
      inquiries: report.inquiries.map((item) => ({
        ...item,
        evidence: [evidence(item.bureau, item.page, 'inquiry')],
      })),
      negativeItems: report.negativeItems.map((item) => ({
        ...item,
        evidence: [evidence(item.bureau, item.page, 'negative-item')],
      })),
    },
    exceptions,
    provenance: {
      reportDocumentId: source.reportDocumentId,
      clientId: source.clientId,
      sourceVersion: source.sha256,
      processKey: REPORT_PROCESS_VERSIONS.extract.key,
      processVersion: 1,
      outputSchemaVersion: 1,
    },
  };
}

export function staleExtraction<T extends { provenance: { sourceVersion: string } }>(
  artifact: T,
  currentSha256: string,
) {
  return { artifact, stale: artifact.provenance.sourceVersion !== currentSha256 };
}
