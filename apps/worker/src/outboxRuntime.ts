import { Queue, QueueEvents, Worker, type JobsOptions } from 'bullmq';
import { assertCreditDatabaseUrl } from '@credit/runtime';
import { createClient } from 'redis';
import { Pool } from 'pg';
import type { Logger } from 'pino';

export const OUTBOX_QUEUE = 'credit-outbox-v1';
export const REALTIME_CHANNEL = 'credit:realtime:events';
export const BULLMQ_JOB_ATTEMPTS = 5;
export const OUTBOX_MAX_CLAIMS = 5;
export const outboxJobOptions: JobsOptions = {
  attempts: BULLMQ_JOB_ATTEMPTS,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 500,
  removeOnFail: 1000,
};
export function outboxFailureDisposition(attemptCountBeforeClaim: number) {
  return attemptCountBeforeClaim + 1 >= OUTBOX_MAX_CLAIMS ? 'FAILED' : 'PENDING';
}

type ClaimedEvent = {
  id: string;
  eventType: string;
  aggregateId: string | null;
  payload: unknown;
  payloadVersion: number;
  createdAt: Date;
  attemptCount: number;
};

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

export function toClientEnvelope(event: ClaimedEvent) {
  const payload = event.payload as { clientId?: unknown; domains?: unknown };
  if (
    event.eventType.startsWith('commerce.gateway.') &&
    Array.isArray(payload?.domains) &&
    payload.domains.every((domain) => typeof domain === 'string')
  )
    return null;
  if (typeof payload?.clientId !== 'string' || !Array.isArray(payload.domains))
    throw new Error('OUTBOX_PAYLOAD_UNSAFE');
  return {
    id: event.id,
    version: 1 as const,
    type: 'resource.changed' as const,
    occurredAt: event.createdAt.toISOString(),
    publishedAt: new Date().toISOString(),
    clientId: payload.clientId,
    domains: payload.domains,
    refetch: true as const,
  };
}

export async function startOutboxRuntime(options: {
  databaseUrl: string;
  redisUrl: string;
  logger: Logger;
  pollIntervalMs?: number;
  processNotificationDelivery?: (deliveryId: string) => Promise<void>;
  queueName?: string;
}) {
  const pool = new Pool({
    connectionString: assertCreditDatabaseUrl(options.databaseUrl),
    max: 4,
  });
  const connection = bullConnection(options.redisUrl);
  const queueName = options.queueName ?? OUTBOX_QUEUE;
  const queue = new Queue(queueName, { connection });
  const queueEvents = new QueueEvents(queueName, { connection });
  await queueEvents.waitUntilReady();
  const redis = createClient({ url: options.redisUrl });
  await redis.connect();
  const worker = new Worker(
    queueName,
    async (job) => {
      const deliveryId = (job.data as { notificationDeliveryId?: unknown }).notificationDeliveryId;
      if (typeof deliveryId === 'string') {
        if (!options.processNotificationDelivery)
          throw new Error('NOTIFICATION_DELIVERY_PROCESSOR_UNAVAILABLE');
        await options.processNotificationDelivery(deliveryId);
      }
      const envelope = (job.data as { envelope?: unknown }).envelope ?? job.data;
      await redis.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
      return { published: true, eventId: job.id };
    },
    { connection, concurrency: 8 },
  );
  worker.on('failed', (job, error) =>
    options.logger.error({ jobId: job?.id, err: error }, 'Outbox dispatch job failed'),
  );
  await worker.waitUntilReady();

  let active = true;
  const publishBatch = async (limit = 25) => {
    const client = await pool.connect();
    let events: ClaimedEvent[];
    try {
      await client.query('BEGIN');
      const result = await client.query<ClaimedEvent>(
        `
        SELECT id, "eventType", "aggregateId", payload, "payloadVersion", "createdAt", "attemptCount"
        FROM "OutboxEvent"
        WHERE status = 'PENDING' AND "availableAt" <= now()
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      `,
        [limit],
      );
      events = result.rows;
      if (events.length)
        await client.query(
          `UPDATE "OutboxEvent" SET "attemptCount" = "attemptCount" + 1, "lastAttemptAt" = now(),
             "availableAt" = now() + interval '30 seconds'
           WHERE id = ANY($1::uuid[])`,
          [events.map(({ id }) => id)],
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }

    for (const event of events) {
      try {
        const envelope = toClientEnvelope(event);
        if (envelope === null) {
          await pool.query(
            `UPDATE "OutboxEvent" SET status = 'PUBLISHED', "publishedAt" = now(), "lastErrorCode" = NULL WHERE id = $1`,
            [event.id],
          );
          continue;
        }
        const deliveryId = (event.payload as { notificationDeliveryId?: unknown })
          .notificationDeliveryId;
        const job = await queue.add(
          'dispatch-realtime',
          typeof deliveryId === 'string'
            ? { envelope, notificationDeliveryId: deliveryId }
            : envelope,
          {
            ...outboxJobOptions,
            // A failed Bull job remains retained for diagnostics. Use the
            // durable database attempt as part of the transport identity so
            // a recovered outbox event can actually be delivered again.
            jobId: `${event.id}-${event.attemptCount + 1}`,
          },
        );
        await job.waitUntilFinished(queueEvents, 15_000);
        await pool.query(
          `UPDATE "OutboxEvent" SET status = 'PUBLISHED', "publishedAt" = now(), "lastErrorCode" = NULL WHERE id = $1`,
          [event.id],
        );
      } catch (error) {
        const disposition = outboxFailureDisposition(event.attemptCount);
        await pool.query(
          `UPDATE "OutboxEvent" SET status = $2::"OutboxEventStatus", "lastErrorCode" = $3,
             "availableAt" = now() + interval '5 seconds' WHERE id = $1`,
          [event.id, disposition, 'OUTBOX_PUBLISH_FAILED'],
        );
        options.logger.error({ eventId: event.id, err: error }, 'Outbox publication failed');
      }
    }
    return events.length;
  };
  const timer = setInterval(
    () =>
      active &&
      void publishBatch().catch((err) => options.logger.error({ err }, 'Outbox poll failed')),
    options.pollIntervalMs ?? 1000,
  );
  // Startup readiness must not be held hostage by unrelated poison events in
  // the remainder of a bounded batch. Drain the single oldest event now; the
  // regular poll immediately resumes normal 25-event batches.
  await publishBatch(1);
  return {
    publishBatch,
    async close() {
      active = false;
      clearInterval(timer);
      await Promise.allSettled([
        worker.close(),
        queueEvents.close(),
        queue.close(),
        redis.quit(),
        pool.end(),
      ]);
    },
  };
}
