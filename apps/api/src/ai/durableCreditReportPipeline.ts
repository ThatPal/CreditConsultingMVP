import type { AIJobQueue, DurableAIRuntime } from './durableRuntime.js';
import type {
  AIProvider,
  ProcessDefinition,
  ProviderRequest,
  ProviderResponse,
  SourceVersions,
} from './runtime.js';
import {
  extractReport,
  validateSupportedReport,
  type ReportSource,
  type SyntheticReport,
} from './creditReportProcessing.js';
import {
  matchClientCards,
  normalizeTradelines,
  reconcileAccounts,
  type PortfolioCard,
} from './creditReportReconciliation.js';
import {
  prepareDeterministicStrategyProposal,
  STRATEGY_PREPARE_PROCESS,
} from '../strategies/ai.js';

export const PHASE_7_PROCESSES = [
  ['credit_report.validate', 'document_extraction'],
  ['credit_report.extract', 'document_extraction'],
  ['credit_report.normalize', 'fast_classification'],
  ['credit_report.reconcile_accounts', 'reasoning_standard'],
  ['credit_report.match_cards', 'reasoning_standard'],
] as const;

const definition = ([
  processKey,
  modelProfile,
]: (typeof PHASE_7_PROCESSES)[number]): ProcessDefinition => ({
  processKey,
  processVersion: 1,
  authorityLevel: 'FACTUAL_LEVEL_1',
  enabled: true,
  modelProfile,
  inputSchemaVersion: 1,
  outputSchemaVersion: 1,
  maxAttempts: 3,
  dataClassification: 'CLIENT_FINANCIAL_REPORT',
});

export class Phase7DeterministicProvider implements AIProvider {
  readonly name = 'deterministic-phase7';
  async execute(request: ProviderRequest): Promise<ProviderResponse> {
    const input = request.input as Record<string, unknown>;
    let result: unknown;
    switch (request.process.processKey) {
      case 'credit_report.validate':
        result = validateSupportedReport(
          input.source as ReportSource,
          input.report as SyntheticReport,
        );
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
        result = matchClientCards(
          input.logicalAccounts as Parameters<typeof matchClientCards>[0],
          input.cards as PortfolioCard[],
        );
        break;
      case STRATEGY_PREPARE_PROCESS:
        return prepareDeterministicStrategyProposal(request);
      default:
        throw new Error('PROCESS_NOT_SUPPORTED');
    }
    return {
      result,
      confidence: 'high',
      evidence: [],
      exceptions: [],
      provider: this.name,
      model: 'fixture-v1',
    };
  }
}

export const phase7Validators = Object.fromEntries(
  PHASE_7_PROCESSES.map(([key]) => [
    `${key}@1`,
    (value: unknown) => typeof value === 'object' && value !== null,
  ]),
);

export async function registerPhase7Processes(runtime: DurableAIRuntime) {
  for (const entry of PHASE_7_PROCESSES)
    await runtime.registerProcess({
      ...definition(entry),
      instructionVersion: 'phase7-v1',
      domainConsumer: 'credit-review',
      allowedContext: ['one-report', 'owning-client-cards'],
    });
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
  const validation = await execute('credit_report.validate', {
    source: input.source,
    report: input.report,
  });
  const validationResult = validation.outputs[0]?.result as { supported?: boolean } | undefined;
  if (!validationResult?.supported)
    return {
      validation,
      extraction: null,
      normalization: null,
      reconciliation: null,
      matching: null,
    };
  const extraction = await execute('credit_report.extract', {
    source: input.source,
    report: input.report,
  });
  const extracted = extraction.outputs[0]?.result as ReturnType<typeof extractReport>;
  if (extracted.status !== 'SUCCEEDED' || !extracted.facts)
    return { validation, extraction, normalization: null, reconciliation: null, matching: null };
  const normalization = await execute('credit_report.normalize', {
    tradelines: extracted.facts.tradelines,
  });
  const normalized = normalization.outputs[0]?.result as ReturnType<typeof normalizeTradelines>;
  const reconciliation = await execute('credit_report.reconcile_accounts', { normalized });
  const reconciled = reconciliation.outputs[0]?.result as ReturnType<typeof reconcileAccounts>;
  const matching = await execute('credit_report.match_cards', {
    logicalAccounts: reconciled.logicalAccounts,
    cards: input.cards,
  });
  return { validation, extraction, normalization, reconciliation, matching };
}

export async function enqueueDurablePhase7Pipeline(input: {
  runtime: DurableAIRuntime;
  source: ReportSource;
  report: SyntheticReport;
  cards: PortfolioCard[];
  correlationId: string;
}) {
  await registerPhase7Processes(input.runtime);
  return input.runtime.createAndEnqueue({
    processKey: 'credit_report.validate',
    processVersion: 1,
    clientId: input.source.clientId,
    correlationId: input.correlationId,
    relatedEntityType: 'CreditReportDocument',
    relatedEntityId: input.source.reportDocumentId,
    sourceIdentity: input.source.sha256,
    sourceVersions: { report: input.source.sha256 },
    input: { source: input.source, report: input.report, cards: input.cards },
  });
}

export async function advanceDurablePhase7Pipeline(
  runtime: DurableAIRuntime,
  completed: Awaited<ReturnType<DurableAIRuntime['processJob']>>,
) {
  if (completed.status !== 'SUCCEEDED' || !completed.outputs[0]) return completed;
  const key = completed.processDefinition.processKey;
  const envelope = completed.inputEnvelope as Record<string, unknown>;
  const result = completed.outputs[0].result as Record<string, unknown>;
  let next: { key: string; input: Record<string, unknown> } | null = null;
  if (key === 'credit_report.validate' && result.supported)
    next = { key: 'credit_report.extract', input: envelope };
  else if (key === 'credit_report.extract' && result.status === 'SUCCEEDED')
    next = {
      key: 'credit_report.normalize',
      input: { ...envelope, tradelines: (result.facts as { tradelines: unknown[] }).tradelines },
    };
  else if (key === 'credit_report.normalize')
    next = { key: 'credit_report.reconcile_accounts', input: { ...envelope, normalized: result } };
  else if (key === 'credit_report.reconcile_accounts')
    next = {
      key: 'credit_report.match_cards',
      input: { ...envelope, logicalAccounts: result.logicalAccounts },
    };
  if (!next) return completed;
  return runtime.createAndEnqueue({
    processKey: next.key,
    processVersion: 1,
    clientId: completed.clientId,
    correlationId: completed.correlationId,
    relatedEntityType: completed.relatedEntityType,
    relatedEntityId: completed.relatedEntityId,
    sourceIdentity: completed.sourceIdentity,
    sourceVersions: completed.sourceVersions as SourceVersions,
    input: next.input,
  });
}

export class RecordingAIQueue implements AIJobQueue {
  readonly jobIds = new Set<string>();
  async add(_name: string, data: { jobId: string }) {
    this.jobIds.add(data.jobId);
    return { id: data.jobId };
  }
  loseAll() {
    this.jobIds.clear();
  }
}
