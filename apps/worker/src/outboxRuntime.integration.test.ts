import { createClient } from 'redis';
import { Pool } from 'pg';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { REALTIME_CHANNEL, startOutboxRuntime } from './outboxRuntime.js';

describe('database to realtime outbox pipeline', () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required');
  const pool = new Pool({ connectionString: databaseUrl });

  beforeAll(async () => {
    await pool.query('SELECT 1');
  });
  afterAll(async () => pool.end());

  test('claims, queues, publishes, and durably marks one client-safe event', async () => {
    const eventId = crypto.randomUUID();
    const eventKey = `sprint-3.1:${eventId}`;
    const clientId = '22222222-2222-4222-8222-222222222222';
    const subscriber = createClient({ url: redisUrl });
    await subscriber.connect();
    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for outbox dispatch')),
        5000,
      );
      void subscriber.subscribe(REALTIME_CHANNEL, (raw) => {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.id !== eventId) return;
        clearTimeout(timer);
        resolve(event);
      });
    });
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload)
       VALUES ($1, 'SUPPORT_UPDATED', $2, 'SupportCase', 'case-1', $3::jsonb)`,
      [
        eventId,
        eventKey,
        JSON.stringify({ clientId, domains: ['support'], secret: 'server-only' }),
      ],
    );
    const runtime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
    });
    try {
      await expect(received).resolves.toMatchObject({
        id: eventId,
        clientId,
        domains: ['support'],
        refetch: true,
      });
      const persisted = await pool.query<{ status: string; attemptCount: number }>(
        `SELECT status, "attemptCount" FROM "OutboxEvent" WHERE id = $1`,
        [eventId],
      );
      expect(persisted.rows[0]).toEqual({ status: 'PUBLISHED', attemptCount: 1 });
      expect(await received).not.toHaveProperty('secret');
    } finally {
      await runtime.close();
      await subscriber.quit();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  });
});
