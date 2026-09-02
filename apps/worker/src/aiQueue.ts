import { Queue, Worker, type JobsOptions } from 'bullmq';
import { bullConnection } from './outboxRuntime.js';

export const AI_QUEUE = 'credit-ai-v1';
export const aiJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

export function createAIQueue(redisUrl: string) {
  return new Queue(AI_QUEUE, { connection: bullConnection(redisUrl) });
}

export function startAIWorker(redisUrl: string, processJob: (jobId: string) => Promise<void>) {
  return new Worker(AI_QUEUE, async (job) => processJob(String(job.data.jobId)), {
    connection: bullConnection(redisUrl),
    concurrency: 4,
  });
}
