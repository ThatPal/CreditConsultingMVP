import type { AIJobQueue, DurableAIRuntime } from './durableRuntime.js';
import type { AIProvider, ProcessDefinition, ProviderRequest, ProviderResponse } from './runtime.js';
import { extractReport, validateSupportedReport, type ReportSource, type SyntheticReport } from './creditReportProcessing.js';
import { matchClientCards, normalizeTradelines, reconcileAccounts, type PortfolioCard } from './creditReportReconciliation.js';

export const PHASE_7_PROCESSES = [
  ['credit_report.validate', 'document_extraction'],
  ['credit_report.extract', 'document_extraction'],
  ['credit_report.normalize', 'fast_classification'],
  ['credit_report.reconcile_accounts', 'reasoning_standard'],
  ['credit_report.match_cards', 'reasoning_standard'],
] as const;

const definition = ([processKey, modelProfile]: (typeof PHASE_7_PROCESSES)[number]): ProcessDefinition => ({
  processKey, processVersion: 1, authorityLevel: 'FACTUAL_LEVEL_1', enabled: true,
  modelProfile, inputSchemaVersion: 1, outputSchemaVersion: 1, maxAttempts: 3,
  dataClassification: 'CLIENT_FINANCIAL_REPORT',
});

export class Phase7DeterministicProvider implements AIProvider {
  readonly name = 'deterministic-phase7';
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const input = request.input as Record<string, unknown>;
    let result: unknown;
    switch (request.process.processKey) {
      case 'credit_report.validate':
        result = validateSupportedReport(input.source as ReportSource, input.report as SyntheticReport);
        break;
      case 'credit_report.extract':
        result = extractReport(input.source as ReportSource, input.report as SyntheticReport);
        break;
      case 'credit_report.normalize':
        result = normalizeTradelines(input.tradelines as Parameters<typeof normalizeTradelines>[0]);
        break;
      case 'credit_report.reconcile_accounts':
        result = reconcileAccounts(input.normalized as ReturnType<typeof normalizeTradelines>);
        break;
      case 'credit_report.match_cards':
        result = matchClientCards(input.logicalAccounts as Parameters<typeof matchClientCards>[0], input.cards as PortfolioCard[]);
        break;
      default:
        throw new Error('PROCESS_NOT_SUPPORTED');
    }
    return {
      result, confidence: 'high', evidence: [], exceptions: [],
      provider: this.name, model: 'fixture-v1',
    };
  }
}

export const phase7Validators = Object.fromEntries(
  PHASE_7_PROCESSES.map(([key]) => [`${key}@1`, (value: unknown) => typeof value === 'object' && value !== null]),
);

export async function registerPhase7Processes(runtime: DurableAIRuntime) {
  for (const entry of PHASE_7_PROCESSES)
    await runtime.registerProcess({ ...definition(entry), instructionVersion: 'phase7-v1', domainConsumer: 'credit-review', allowedContext: ['one-report', 'owning-client-cards'] });
}

export async function runDurablePhase7Pipeline(input: {
  runtime: DurableAIRuntime;
  source: ReportSource;
  report: SyntheticReport;
  cards: PortfolioCard[];
  correlationId: string;
}) {
  await registerPhase7Processes(input.runtime);
  const common = {
    clientId: input.source.clientId,
    correlationId: input.correlationId,
    relatedEntityType: 'CreditReportDocument',
    relatedEntityId: input.source.reportDocumentId,
    sourceIdentity: input.source.sha256,
    sourceVersions: { report: input.source.sha256 },
    processVersion: 1,
  };
  const execute = async (processKey: string, jobInput: unknown) => {
    const job = await input.runtime.createAndEnqueue({ ...common, processKey, input: jobInput });
    return input.runtime.processJob(job.id);
  };
  const validation = await execute('credit_report.validate', { source: input.source, report: input.report });
  const validationResult = validation.outputs[0]?.result as { supported?: boolean } | undefined;
  if (!validationResult?.supported) return { validation, extraction: null, normalization: null, reconciliation: null, matching: null };
  const extraction = await execute('credit_report.extract', { source: input.source, report: input.report });
  const extracted = extraction.outputs[0]?.result as ReturnType<typeof extractReport>;
  if (extracted.status !== 'SUCCEEDED' || !extracted.facts)
    return { validation, extraction, normalization: null, reconciliation: null, matching: null };
  const normalization = await execute('credit_report.normalize', { tradelines: extracted.facts.tradelines });
  const normalized = normalization.outputs[0]?.result as ReturnType<typeof normalizeTradelines>;
  const reconciliation = await execute('credit_report.reconcile_accounts', { normalized });
  const reconciled = reconciliation.outputs[0]?.result as ReturnType<typeof reconcileAccounts>;
  const matching = await execute('credit_report.match_cards', { logicalAccounts: reconciled.logicalAccounts, cards: input.cards });
  return { validation, extraction, normalization, reconciliation, matching };
}

export class RecordingAIQueue implements AIJobQueue {
  readonly jobIds = new Set<string>();
  async add(_name: string, data: { jobId: string }) {
    this.jobIds.add(data.jobId);
    return { id: data.jobId };
  }
  loseAll() { this.jobIds.clear(); }
}
