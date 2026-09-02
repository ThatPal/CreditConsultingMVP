import type { PrismaClient } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  AIProvider,
  OutputValidator,
  ProcessDefinition,
  ProviderResponse,
  SourceVersions,
} from './runtime.js';
import { AIProviderError } from './runtime.js';

export interface AIJobQueue {
  add(name: string, data: { jobId: string }, options: { jobId: string }): Promise<unknown>;
}

export type DurableJobInput = {
  processKey: string;
  processVersion: number;
  clientId: string;
  correlationId: string;
  relatedEntityType: string;
  relatedEntityId: string;
  sourceIdentity: string;
  sourceVersions: SourceVersions;
  input: unknown;
};

type ProcessHook = (stage: 'before-result-commit', jobId: string) => Promise<void>;

const json = (value: unknown) => value as Prisma.InputJsonValue;
const confidence = (value: ProviderResponse['confidence']) => value.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW';

export class DurableAIRuntime {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queue: AIJobQueue,
    private readonly provider: AIProvider | null,
    private readonly validators: Record<string, OutputValidator>,
    private readonly hook?: ProcessHook,
  ) {}

  async registerProcess(definition: ProcessDefinition & {
    instructionVersion?: string;
    domainConsumer?: string;
    allowedContext?: unknown;
  }) {
    return this.prisma.aIProcessDefinition.upsert({
      where: {
        processKey_processVersion: {
          processKey: definition.processKey,
          processVersion: definition.processVersion,
        },
      },
      create: {
        processKey: definition.processKey,
        processVersion: definition.processVersion,
        authorityLevel: definition.authorityLevel,
        enabled: definition.enabled,
        modelProfile: definition.modelProfile,
        inputSchemaVersion: definition.inputSchemaVersion,
        outputSchemaVersion: definition.outputSchemaVersion,
        instructionVersion: definition.instructionVersion ?? 'v1',
        retryPolicy: { maxAttempts: definition.maxAttempts },
        dataClassification: definition.dataClassification,
        allowedContext: json(definition.allowedContext ?? []),
        domainConsumer: definition.domainConsumer ?? 'credit-review',
      },
      update: {},
    });
  }

  async createAndEnqueue(input: DurableJobInput) {
    const process = await this.prisma.aIProcessDefinition.findUnique({
      where: { processKey_processVersion: { processKey: input.processKey, processVersion: input.processVersion } },
    });
    if (!process?.enabled) throw new AIProviderError('AI process is unavailable', true, 'AI_UNAVAILABLE');
    if (process.authorityLevel !== 'FACTUAL_LEVEL_1')
      throw new AIProviderError('Prohibited AI authority level', false, 'AI_AUTHORITY_PROHIBITED');
    const job = await this.prisma.aIJob.upsert({
      where: {
        processDefinitionId_sourceIdentity_correlationId: {
          processDefinitionId: process.id,
          sourceIdentity: input.sourceIdentity,
          correlationId: input.correlationId,
        },
      },
      create: {
        processDefinitionId: process.id,
        clientId: input.clientId,
        correlationId: input.correlationId,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        sourceIdentity: input.sourceIdentity,
        inputSchemaVersion: process.inputSchemaVersion,
        outputSchemaVersion: process.outputSchemaVersion,
        sourceVersions: json(input.sourceVersions),
        inputEnvelope: json(input.input),
        maxAttempts: Number((process.retryPolicy as { maxAttempts?: number }).maxAttempts ?? 3),
      },
      update: {},
      include: { outputs: true },
    });
    if (job.status === 'QUEUED' || job.status === 'RETRYABLE_FAILURE')
      await this.queue.add('run-ai-job', { jobId: job.id }, { jobId: job.id });
    return job;
  }

  async processJob(jobId: string) {
    const existing = await this.prisma.aIJob.findUnique({
      where: { id: jobId }, include: { processDefinition: true, outputs: true },
    });
    if (!existing) throw new Error('JOB_NOT_FOUND');
    if (existing.status === 'SUCCEEDED' && existing.outputs[0]) return existing;
    const claimed = await this.prisma.aIJob.updateMany({
      where: {
        id: jobId,
        status: { in: ['QUEUED', 'RETRYABLE_FAILURE'] },
        currentAttempt: { lt: existing.maxAttempts },
      },
      data: { status: 'RUNNING', currentAttempt: { increment: 1 }, startedAt: new Date(), failureCode: null, failureCategory: null },
    });
    if (claimed.count !== 1) {
      const current = await this.prisma.aIJob.findUnique({ where: { id: jobId }, include: { processDefinition: true, outputs: true } });
      if (current?.status === 'SUCCEEDED' && current.outputs[0]) return current;
      throw new Error('JOB_ALREADY_RUNNING');
    }
    const job = await this.prisma.aIJob.findUniqueOrThrow({
      where: { id: jobId }, include: { processDefinition: true, outputs: true },
    });
    if (!this.provider) return this.persistFailure(job.id, true, 'AI_UNAVAILABLE', 'PROVIDER');
    try {
      const process: ProcessDefinition = {
        processKey: job.processDefinition.processKey,
        processVersion: job.processDefinition.processVersion,
        authorityLevel: job.processDefinition.authorityLevel,
        enabled: job.processDefinition.enabled,
        modelProfile: job.processDefinition.modelProfile,
        inputSchemaVersion: job.inputSchemaVersion,
        outputSchemaVersion: job.outputSchemaVersion,
        maxAttempts: job.maxAttempts,
        dataClassification: job.processDefinition.dataClassification,
      };
      const response = await this.provider.execute({
        jobId: job.id,
        process,
        input: job.inputEnvelope,
        sourceVersions: job.sourceVersions as SourceVersions,
      });
      const validator = this.validators[`${process.processKey}@${process.outputSchemaVersion}`];
      if (!validator?.(response.result))
        return this.persistFailure(job.id, false, 'OUTPUT_SCHEMA_INVALID', 'SCHEMA', 'SCHEMA_INVALID');
      await this.hook?.('before-result-commit', job.id);
      return this.prisma.$transaction(async (tx) => {
        const output = await tx.aIJobOutput.upsert({
          where: { jobId_outputVersion: { jobId: job.id, outputVersion: 1 } },
          create: {
            jobId: job.id,
            outputVersion: 1,
            outputSchemaVersion: process.outputSchemaVersion,
            status: 'VALIDATED',
            result: json(response.result),
            exceptions: json(response.exceptions),
            confidence: confidence(response.confidence),
            evidence: json(response.evidence),
            humanReview: json({ required: response.exceptions.some((item) => item.humanReviewRequired) }),
            provenance: json({
              processKey: process.processKey,
              processVersion: process.processVersion,
              provider: response.provider,
              model: response.model,
              modelProfile: process.modelProfile,
              generatedAt: new Date().toISOString(),
              attempt: job.currentAttempt,
              latencyMs: response.latencyMs ?? null,
              tokenUsage: response.tokenUsage ?? null,
            }),
            sourceVersions: json(job.sourceVersions),
          },
          update: {},
        });
        if (job.relatedEntityType === 'CreditReportDocument')
          await tx.creditReportArtifact.upsert({
            where: {
              reportDocumentId_artifactType_artifactVersion: {
                reportDocumentId: job.relatedEntityId,
                artifactType: process.processKey,
                artifactVersion: 1,
              },
            },
            create: {
              reportDocumentId: job.relatedEntityId,
              aiJobId: job.id,
              aiJobOutputId: output.id,
              artifactType: process.processKey,
              artifactVersion: 1,
              sourceVersion: job.sourceIdentity,
              schemaVersion: process.outputSchemaVersion,
              payload: json(response.result),
            },
            update: {},
          });
        await tx.aIJob.update({
          where: { id: job.id },
          data: { status: 'SUCCEEDED', completedAt: new Date(), failureCode: null, failureCategory: null },
        });
        return tx.aIJob.findUniqueOrThrow({ where: { id: job.id }, include: { processDefinition: true, outputs: true, artifacts: true } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof AIProviderError)
        return this.persistFailure(job.id, error.retryable, error.code, 'PROVIDER');
      if (error instanceof Error && error.message === 'SIMULATED_CRASH') throw error;
      return this.persistFailure(job.id, true, 'PROVIDER_FAILURE', 'PROVIDER');
    }
  }

  private async persistFailure(
    jobId: string,
    retryable: boolean,
    code: string,
    category: string,
    forcedStatus?: 'SCHEMA_INVALID',
  ) {
    const job = await this.prisma.aIJob.findUniqueOrThrow({ where: { id: jobId } });
    const canRetry = retryable && job.currentAttempt < job.maxAttempts;
    return this.prisma.aIJob.update({
      where: { id: jobId },
      data: {
        status: forcedStatus ?? (canRetry ? 'RETRYABLE_FAILURE' : 'NON_RETRYABLE_FAILURE'),
        failureCode: code,
        failureCategory: category,
        availableAt: canRetry ? new Date() : job.availableAt,
        completedAt: canRetry ? null : new Date(),
      },
      include: { processDefinition: true, outputs: true, artifacts: true },
    });
  }

  async reconstructAndEnqueue(staleRunningBefore = new Date(Date.now() - 60_000)) {
    await this.prisma.aIJob.updateMany({
      where: { status: 'RUNNING', startedAt: { lt: staleRunningBefore }, outputs: { none: {} } },
      data: { status: 'QUEUED', failureCode: 'WORKER_RESTART_RECOVERY' },
    });
    const jobs = await this.prisma.aIJob.findMany({
      where: {
        status: { in: ['QUEUED', 'RETRYABLE_FAILURE'] },
        availableAt: { lte: new Date() },
        currentAttempt: { lt: 3 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const job of jobs)
      await this.queue.add('run-ai-job', { jobId: job.id }, { jobId: job.id });
    return jobs.map(({ id }) => id);
  }

  async markStale(jobId: string, currentSourceVersions: SourceVersions) {
    const job = await this.prisma.aIJob.findUniqueOrThrow({ where: { id: jobId } });
    if (JSON.stringify(job.sourceVersions) === JSON.stringify(currentSourceVersions)) return job;
    return this.prisma.$transaction(async (tx) => {
      await tx.aIJobOutput.updateMany({ where: { jobId, staleAt: null }, data: { staleAt: new Date() } });
      await tx.creditReportArtifact.updateMany({ where: { aiJobId: jobId, current: true }, data: { current: false, staleAt: new Date() } });
      return tx.aIJob.update({ where: { id: jobId }, data: { status: 'STALE' } });
    });
  }

  async inspect(jobId: string, clientId: string) {
    const job = await this.prisma.aIJob.findFirst({
      where: { id: jobId, clientId }, include: { processDefinition: true, outputs: true, artifacts: true },
    });
    if (!job) throw new Error('NOT_FOUND');
    return job;
  }

  async consumeCurrentArtifact(reportDocumentId: string, artifactType: string, clientId: string) {
    const artifact = await this.prisma.creditReportArtifact.findFirst({
      where: { reportDocumentId, artifactType, current: true, staleAt: null, aiJob: { clientId, status: 'SUCCEEDED' } },
    });
    if (!artifact) throw new Error('CURRENT_ARTIFACT_NOT_FOUND');
    return artifact;
  }
}
