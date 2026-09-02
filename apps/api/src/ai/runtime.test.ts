import { describe, expect, test } from 'vitest';
import {
  AIProviderError,
  InMemoryAIRuntime,
  DeterministicAIProvider,
  type ProcessDefinition,
} from './runtime.js';

const process: ProcessDefinition = {
  processKey: 'fixture.process', processVersion: 1, authorityLevel: 'FACTUAL_LEVEL_1',
  enabled: true, modelProfile: 'document_extraction', inputSchemaVersion: 1,
  outputSchemaVersion: 1, maxAttempts: 3, dataClassification: 'CLIENT_FINANCIAL',
};
const response = { result: { valid: true }, confidence: 'high' as const, evidence: [], exceptions: [], provider: 'test', model: 'fixed-v1' };
const create = (runtime: InMemoryAIRuntime) => runtime.createJob({ clientId: 'client-a', correlationId: 'corr', relatedEntityId: 'report', sourceIdentity: 'sha256:a', process, input: {}, sourceVersions: { report: 'sha256:a' } });

describe('governed AI runtime', () => {
  test('validates, succeeds, stores provenance, and is duplicate safe', async () => {
    const runtime = new InMemoryAIRuntime(new DeterministicAIProvider(() => response), { 'fixture.process@1': (value) => (value as { valid?: boolean }).valid === true });
    const job = create(runtime);
    expect((await runtime.run(job.id)).status).toBe('SUCCEEDED');
    expect((await runtime.run(job.id)).output?.sourceVersions).toEqual({ report: 'sha256:a' });
    expect(runtime.outputCount()).toBe(1);
  });
  test('transient failure is retryable and recovery requeues it', async () => {
    let attempt = 0;
    const runtime = new InMemoryAIRuntime(new DeterministicAIProvider(() => { if (!attempt++) throw new AIProviderError('down', true, 'PROVIDER_DOWN'); return response; }), { 'fixture.process@1': () => true });
    const job = create(runtime);
    expect((await runtime.run(job.id)).status).toBe('RETRYABLE_FAILURE');
    runtime.requeueRecoverable();
    expect((await runtime.run(job.id)).status).toBe('SUCCEEDED');
  });
  test('invalid output, stale context, disabled provider and cross-client reads fail closed', async () => {
    const runtime = new InMemoryAIRuntime(new DeterministicAIProvider(() => response), { 'fixture.process@1': () => false });
    const job = create(runtime);
    expect((await runtime.run(job.id)).status).toBe('SCHEMA_INVALID');
    expect(runtime.markStale(job.id, { report: 'sha256:b' }).status).toBe('STALE');
    expect(() => runtime.getJob(job.id, 'client-b')).toThrow('NOT_FOUND');
    expect(() => create(new InMemoryAIRuntime(null, {}))).toThrowError(AIProviderError);
  });
});
