import { createHash, randomUUID } from 'node:crypto';

export type AIConfidence = 'high' | 'medium' | 'low';
export type Evidence = {
  kind: 'direct_source' | 'canonical_fact' | 'deterministic_calculation' | 'ai_inference';
  source: string;
  page?: number;
  label?: string;
};
export type AIException = {
  key: string;
  category: string;
  summary: string;
  materiality: 'material' | 'non_material';
  confidence: AIConfidence;
  evidence: Evidence[];
  suggestedResolution?: string;
  humanReviewRequired: boolean;
  blockingBehavior: 'block' | 'review' | 'none';
};
export type SourceVersions = Record<string, string>;

export type ProcessDefinition = {
  processKey: string;
  processVersion: number;
  authorityLevel: 'FACTUAL_LEVEL_1';
  enabled: boolean;
  modelProfile: string;
  inputSchemaVersion: number;
  outputSchemaVersion: number;
  maxAttempts: number;
  dataClassification: string;
};

export type ProviderRequest = {
  jobId: string;
  process: ProcessDefinition;
  input: unknown;
  sourceVersions: SourceVersions;
};
export type ProviderResponse = {
  result: unknown;
  confidence: AIConfidence;
  evidence: Evidence[];
  exceptions: AIException[];
  provider: string;
  model: string;
  latencyMs?: number;
  tokenUsage?: { input: number; output: number };
};
export interface AIProvider {
  readonly name: string;
  execute(request: ProviderRequest): Promise<ProviderResponse>;
}
export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: string,
  ) {
    super(message);
  }
}

export type RuntimeJob = {
  id: string;
  clientId: string;
  correlationId: string;
  relatedEntityId: string;
  sourceIdentity: string;
  process: ProcessDefinition;
  input: unknown;
  sourceVersions: SourceVersions;
  status:
    | 'QUEUED'
    | 'RUNNING'
    | 'SUCCEEDED'
    | 'RETRYABLE_FAILURE'
    | 'NON_RETRYABLE_FAILURE'
    | 'SCHEMA_INVALID'
    | 'STALE';
  attempt: number;
  output?: RuntimeOutput;
  failureCode?: string;
};
export type RuntimeOutput = ProviderResponse & {
  outputSchemaVersion: number;
  generatedAt: string;
  sourceVersions: SourceVersions;
  attempt: number;
  fingerprint: string;
};

export type OutputValidator = (value: unknown) => boolean;

export class AIRuntime {
  private readonly jobs = new Map<string, RuntimeJob>();
  private readonly outputs = new Map<string, RuntimeOutput>();

  constructor(
    private readonly provider: AIProvider | null,
    private readonly validators: Record<string, OutputValidator>,
  ) {}

  createJob(input: Omit<RuntimeJob, 'id' | 'status' | 'attempt'>): RuntimeJob {
    if (!input.process.enabled || !this.provider)
      throw new AIProviderError('AI processing is unavailable', true, 'AI_UNAVAILABLE');
    if (input.process.authorityLevel !== 'FACTUAL_LEVEL_1')
      throw new AIProviderError('Prohibited AI authority level', false, 'AI_AUTHORITY_PROHIBITED');
    const id = randomUUID();
    const job: RuntimeJob = { ...input, id, status: 'QUEUED', attempt: 0 };
    this.jobs.set(id, job);
    return job;
  }

  getJob(jobId: string, clientId: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.clientId !== clientId) throw new Error('NOT_FOUND');
    return job;
  }

  async run(jobId: string): Promise<RuntimeJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('JOB_NOT_FOUND');
    if (job.status === 'SUCCEEDED') return job;
    if (!this.provider) {
      job.status = 'RETRYABLE_FAILURE';
      job.failureCode = 'AI_UNAVAILABLE';
      return job;
    }
    job.status = 'RUNNING';
    job.attempt += 1;
    try {
      const response = await this.provider.execute({
        jobId,
        process: job.process,
        input: job.input,
        sourceVersions: job.sourceVersions,
      });
      const validator = this.validators[`${job.process.processKey}@${job.process.outputSchemaVersion}`];
      if (!validator?.(response.result)) {
        job.status = 'SCHEMA_INVALID';
        job.failureCode = 'OUTPUT_SCHEMA_INVALID';
        return job;
      }
      const fingerprint = createHash('sha256')
        .update(JSON.stringify([job.id, job.sourceIdentity, job.process.processVersion]))
        .digest('hex');
      const output = this.outputs.get(fingerprint) ?? {
        ...response,
        outputSchemaVersion: job.process.outputSchemaVersion,
        generatedAt: new Date().toISOString(),
        sourceVersions: { ...job.sourceVersions },
        attempt: job.attempt,
        fingerprint,
      };
      this.outputs.set(fingerprint, output);
      job.output = output;
      job.status = 'SUCCEEDED';
      delete job.failureCode;
      return job;
    } catch (error) {
      const providerError =
        error instanceof AIProviderError
          ? error
          : new AIProviderError('Provider failed', true, 'PROVIDER_FAILURE');
      job.failureCode = providerError.code;
      job.status =
        providerError.retryable && job.attempt < job.process.maxAttempts
          ? 'RETRYABLE_FAILURE'
          : 'NON_RETRYABLE_FAILURE';
      return job;
    }
  }

  requeueRecoverable() {
    for (const job of this.jobs.values())
      if (job.status === 'RUNNING' || job.status === 'RETRYABLE_FAILURE') job.status = 'QUEUED';
  }

  markStale(jobId: string, current: SourceVersions) {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('JOB_NOT_FOUND');
    if (JSON.stringify(job.sourceVersions) !== JSON.stringify(current)) job.status = 'STALE';
    return job;
  }

  outputCount() {
    return this.outputs.size;
  }
}

export class DeterministicAIProvider implements AIProvider {
  readonly name = 'deterministic-test';
  constructor(private readonly handler: (request: ProviderRequest) => ProviderResponse) {}
  async execute(request: ProviderRequest) {
    return this.handler(request);
  }
}
