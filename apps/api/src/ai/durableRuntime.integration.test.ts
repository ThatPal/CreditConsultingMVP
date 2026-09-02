import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { DurableAIRuntime } from './durableRuntime.js';
import { Phase7DeterministicProvider, RecordingAIQueue, phase7Validators, runDurablePhase7Pipeline } from './durableCreditReportPipeline.js';
import { supportedThreeBureauReport } from './fixtures/syntheticReports.js';
import { AIProviderError, DeterministicAIProvider, type ProcessDefinition } from './runtime.js';
import { BullAIJobQueue, startDurableAIWorker } from './bullTransport.js';

describe('Phase 7 C1 durable PostgreSQL runtime', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const marker = `phase7c1-${randomUUID()}`;
  const processKey = `test.durable.${marker}`;
  const validatorKey = `${processKey}@1`;
  const queue = new RecordingAIQueue();
  let prisma: PrismaClient;
  let clientId: string;
  let userId: string;
  const documentIds: string[] = [];
  const definition: ProcessDefinition = {
    processKey, processVersion: 1, authorityLevel: 'FACTUAL_LEVEL_1', enabled: true,
    modelProfile: 'document_extraction', inputSchemaVersion: 1, outputSchemaVersion: 1,
    maxAttempts: 3, dataClassification: 'CLIENT_FINANCIAL_REPORT',
  };
  const successProvider = new DeterministicAIProvider(() => ({
    result: { valid: true, evidence: [{ bureau: 'EXPERIAN', page: 1, label: 'fixture' }] },
    confidence: 'high', evidence: [{ kind: 'direct_source', source: 'EXPERIAN', page: 1, label: 'fixture' }],
    exceptions: [], provider: 'deterministic', model: 'fixture-v1',
  }));
  const runtime = (provider = successProvider, hook?: ConstructorParameters<typeof DurableAIRuntime>[4]) =>
    new DurableAIRuntime(prisma, queue, provider, { [validatorKey]: (value) => (value as { valid?: boolean }).valid === true, ...phase7Validators }, hook);

  async function createDocument(suffix: string) {
    const doc = await prisma.creditReportDocument.create({
      data: {
        storageKey: `${marker}/${suffix}.pdf`, originalFileName: `${suffix}.pdf`,
        mimeType: 'application/pdf', sizeBytes: 100, sha256: `${suffix}`.padEnd(64, 'a').slice(0, 64),
        validationStatus: 'ACCEPTED', uploadedByUserId: userId,
      },
    });
    documentIds.push(doc.id);
    return doc;
  }
  async function createJob(doc: Awaited<ReturnType<typeof createDocument>>, correlation: string) {
    const service = runtime();
    await service.registerProcess(definition);
    return service.createAndEnqueue({
      processKey, processVersion: 1, clientId, correlationId: correlation,
      relatedEntityType: 'CreditReportDocument', relatedEntityId: doc.id,
      sourceIdentity: doc.sha256, sourceVersions: { report: doc.sha256 }, input: { safe: true },
    });
  }

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    const user = await prisma.user.create({
      data: { email: `${marker}@example.test`, role: 'CLIENT', client: { create: { firstName: 'Durable', lastName: 'Runtime', termsAcceptedAt: new Date() } } },
      include: { client: true },
    });
    userId = user.id;
    clientId = user.client!.id;
  });

  afterAll(async () => {
    await prisma.creditReportArtifact.deleteMany({ where: { aiJob: { clientId } } });
    await prisma.aIJobOutput.deleteMany({ where: { job: { clientId } } });
    await prisma.aIJob.deleteMany({ where: { clientId } });
    await prisma.aIProcessDefinition.deleteMany({ where: { processKey: { contains: marker } } });
    await prisma.creditReportDocument.deleteMany({ where: { id: { in: documentIds } } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('durable create/run survives a fresh repository instance', async () => {
    const doc = await createDocument('durable');
    const job = await createJob(doc, `${marker}:durable`);
    await runtime().processJob(job.id);
    const fresh = runtime();
    const persisted = await fresh.inspect(job.id, clientId);
    expect(persisted.status).toBe('SUCCEEDED');
    expect(persisted.outputs).toHaveLength(1);
    expect(persisted.artifacts).toHaveLength(1);
  });

  test('real BullMQ delivery executes the PostgreSQL job by durable ID', async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL is required');
    const doc = await createDocument('bull-delivery');
    const bullQueue = new BullAIJobQueue(redisUrl);
    const service = new DurableAIRuntime(prisma, bullQueue, successProvider, { [validatorKey]: () => true });
    await service.registerProcess(definition);
    const worker = startDurableAIWorker(redisUrl, service);
    await worker.waitUntilReady();
    try {
      const job = await service.createAndEnqueue({
        processKey, processVersion: 1, clientId, correlationId: `${marker}:bull`,
        relatedEntityType: 'CreditReportDocument', relatedEntityId: doc.id,
        sourceIdentity: doc.sha256, sourceVersions: { report: doc.sha256 }, input: { safe: true },
      });
      let persisted = await service.inspect(job.id, clientId);
      for (let attempt = 0; attempt < 50 && persisted.status !== 'SUCCEEDED'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        persisted = await service.inspect(job.id, clientId);
      }
      expect(persisted.status).toBe('SUCCEEDED');
      expect(persisted.outputs).toHaveLength(1);
      expect(persisted.artifacts).toHaveLength(1);
    } finally {
      await worker.close();
      await bullQueue.close();
    }
  });

  test('worker restart and Redis loss reconstruct persisted intent exactly once', async () => {
    const doc = await createDocument('restart');
    const job = await createJob(doc, `${marker}:restart`);
    queue.loseAll();
    const fresh = runtime();
    expect(await fresh.reconstructAndEnqueue()).toContain(job.id);
    expect(queue.jobIds.has(job.id)).toBe(true);
    await fresh.processJob(job.id);
    await fresh.processJob(job.id);
    const persisted = await fresh.inspect(job.id, clientId);
    expect(persisted.outputs).toHaveLength(1);
    expect(persisted.artifacts).toHaveLength(1);
  });

  test('crash before result commit recovers and converges to one output/artifact', async () => {
    const doc = await createDocument('crash');
    const job = await createJob(doc, `${marker}:crash`);
    const crashing = runtime(successProvider, async () => { throw new Error('SIMULATED_CRASH'); });
    await expect(crashing.processJob(job.id)).rejects.toThrow('SIMULATED_CRASH');
    await prisma.aIJob.update({ where: { id: job.id }, data: { startedAt: new Date(0) } });
    const recovered = runtime();
    expect(await recovered.reconstructAndEnqueue(new Date())).toContain(job.id);
    await recovered.processJob(job.id);
    const persisted = await recovered.inspect(job.id, clientId);
    expect(persisted.outputs).toHaveLength(1);
    expect(persisted.artifacts).toHaveLength(1);
  });

  test('duplicate concurrent deliveries cannot create competing terminal effects', async () => {
    const doc = await createDocument('concurrent');
    const job = await createJob(doc, `${marker}:concurrent`);
    await Promise.allSettled([runtime().processJob(job.id), runtime().processJob(job.id)]);
    const persisted = await runtime().inspect(job.id, clientId);
    expect(persisted.status).toBe('SUCCEEDED');
    expect(persisted.outputs).toHaveLength(1);
    expect(persisted.artifacts).toHaveLength(1);
  });

  test('provider and schema failures persist governed non-authoritative states', async () => {
    const unavailableDoc = await createDocument('unavailable');
    const unavailableJob = await createJob(unavailableDoc, `${marker}:unavailable`);
    expect((await new DurableAIRuntime(prisma, queue, null, { [validatorKey]: () => true }).processJob(unavailableJob.id)).status).toBe('RETRYABLE_FAILURE');

    const permanentDoc = await createDocument('permanent');
    const permanentJob = await createJob(permanentDoc, `${marker}:permanent`);
    const permanent = new DeterministicAIProvider(() => { throw new AIProviderError('denied', false, 'PROVIDER_DENIED'); });
    expect((await runtime(permanent).processJob(permanentJob.id)).status).toBe('NON_RETRYABLE_FAILURE');

    const invalidDoc = await createDocument('invalid');
    const invalidJob = await createJob(invalidDoc, `${marker}:invalid`);
    const invalid = new DurableAIRuntime(prisma, queue, successProvider, { [validatorKey]: () => false });
    expect((await invalid.processJob(invalidJob.id)).status).toBe('SCHEMA_INVALID');

    const transientDoc = await createDocument('transient');
    const transientJob = await createJob(transientDoc, `${marker}:transient`);
    let attempts = 0;
    const transient = new DeterministicAIProvider(() => {
      if (attempts++ === 0) throw new AIProviderError('temporary', true, 'PROVIDER_TEMPORARY');
      return { result: { valid: true }, confidence: 'high', evidence: [], exceptions: [], provider: 'deterministic', model: 'fixture-v1' };
    });
    const transientRuntime = runtime(transient);
    expect((await transientRuntime.processJob(transientJob.id)).status).toBe('RETRYABLE_FAILURE');
    expect((await transientRuntime.processJob(transientJob.id)).status).toBe('SUCCEEDED');
    const transientPersisted = await transientRuntime.inspect(transientJob.id, clientId);
    expect(transientPersisted.outputs).toHaveLength(1);
    expect(transientPersisted.artifacts).toHaveLength(1);
  });

  test('persisted stale provenance blocks current consumption and cross-client inspection', async () => {
    const doc = await createDocument('stale');
    const job = await createJob(doc, `${marker}:stale`);
    const service = runtime();
    await service.processJob(job.id);
    await service.markStale(job.id, { report: 'replacement-checksum' });
    const persisted = await service.inspect(job.id, clientId);
    expect(persisted.status).toBe('STALE');
    expect(persisted.outputs[0]?.staleAt).not.toBeNull();
    expect(persisted.artifacts[0]?.current).toBe(false);
    await expect(service.consumeCurrentArtifact(doc.id, processKey, clientId)).rejects.toThrow('CURRENT_ARTIFACT_NOT_FOUND');
    await expect(service.inspect(job.id, randomUUID())).rejects.toThrow('NOT_FOUND');
  });

  test('full five-process synthetic chain is durable with source/evidence provenance', async () => {
    const doc = await createDocument('pipeline');
    const service = new DurableAIRuntime(prisma, queue, new Phase7DeterministicProvider(), phase7Validators);
    const result = await runDurablePhase7Pipeline({
      runtime: service,
      source: { reportDocumentId: doc.id, clientId, sha256: doc.sha256, acceptedReportDate: '2026-08-31', validationStatus: 'ACCEPTED' },
      report: supportedThreeBureauReport,
      cards: [{ id: 'client-card-1', issuer: 'Example Bank', cardName: 'Everyday', maskedIdentifier: '4242', portfolioType: 'PERSONAL_CREDIT', reportsToBureaus: true }],
      correlationId: `${marker}:pipeline`,
    });
    expect(result.matching?.status).toBe('SUCCEEDED');
    const jobs = await prisma.aIJob.findMany({ where: { correlationId: `${marker}:pipeline` }, include: { outputs: true, artifacts: true, processDefinition: true } });
    expect(jobs).toHaveLength(5);
    expect(jobs.every((job) => job.status === 'SUCCEEDED' && job.outputs.length === 1 && job.artifacts.length === 1)).toBe(true);
    const extraction = jobs.find((job) => job.processDefinition.processKey === 'credit_report.extract');
    expect(JSON.stringify(extraction?.outputs[0]?.result)).toContain('EXPERIAN');
    expect(JSON.stringify(extraction?.outputs[0]?.result)).toContain('page');
    expect(extraction?.sourceIdentity).toBe(doc.sha256);
  });
});
