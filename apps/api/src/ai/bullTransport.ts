import { Queue, Worker } from 'bullmq';
import type { AIJobQueue, DurableAIRuntime } from './durableRuntime.js';

export const AI_QUEUE = 'credit-ai-v1';
export function bullConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  const database = url.pathname.slice(1);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
  };
}

export class BullAIJobQueue implements AIJobQueue {
  readonly queue: Queue;
  constructor(redisUrl: string) {
    this.queue = new Queue(AI_QUEUE, { connection: bullConnection(redisUrl) });
  }
  add(name: string, data: { jobId: string }, options: { jobId: string }) {
    return this.queue.add(name, data, {
      ...options,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 500,
      removeOnFail: 1_000,
    });
  }
  close() {
    return this.queue.close();
  }
}

export function startDurableAIWorker(
  redisUrl: string,
  runtime: DurableAIRuntime,
  onProcessed?: (result: Awaited<ReturnType<DurableAIRuntime['processJob']>>) => Promise<unknown>,
) {
  return new Worker(
    AI_QUEUE,
    async (job) => {
      const result = await runtime.processJob(String(job.data.jobId));
      await onProcessed?.(result);
      return result;
    },
    {
      connection: bullConnection(redisUrl),
      concurrency: 4,
    },
  );
}
