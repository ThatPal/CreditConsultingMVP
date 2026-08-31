import { createClient } from 'redis';
import { Pool } from 'pg';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
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

  test('counts durable claims separately and dead-letters an unsafe poison event at the bound', async () => {
    const eventId = crypto.randomUUID();
    const eventKey = `sprint-3.1-c1-poison:${eventId}`;
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload)
       VALUES ($1, 'INTERNAL_UNSAFE', $2, 'Internal', 'poison-1', $3::jsonb)`,
      [eventId, eventKey, JSON.stringify({ internalOnly: true })],
    );
    const runtime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
    });
    try {
      for (let expectedClaims = 1; expectedClaims <= 5; expectedClaims += 1) {
        const persisted = await pool.query<{
          status: string;
          attemptCount: number;
          lastErrorCode: string | null;
        }>(`SELECT status, "attemptCount", "lastErrorCode" FROM "OutboxEvent" WHERE id = $1`, [
          eventId,
        ]);
        expect(persisted.rows[0]).toEqual({
          status: expectedClaims === 5 ? 'FAILED' : 'PENDING',
          attemptCount: expectedClaims,
          lastErrorCode: 'OUTBOX_PUBLISH_FAILED',
        });
        if (expectedClaims < 5) {
          await pool.query(`UPDATE "OutboxEvent" SET "availableAt" = now() WHERE id = $1`, [
            eventId,
          ]);
          await runtime.publishBatch();
        }
      }
    } finally {
      await runtime.close();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  });

  test('resumes durable email delivery after restart without exposing delivery identity realtime', async () => {
    const eventId = crypto.randomUUID();
    const deliveryId = crypto.randomUUID();
    const clientId = '22222222-2222-4222-8222-222222222222';
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload)
       VALUES ($1, 'notification.created', $2, 'Notification', $3, $4::jsonb)`,
      [
        eventId,
        `sprint-3.3-delivery:${eventId}`,
        crypto.randomUUID(),
        JSON.stringify({
          clientId,
          domains: ['notifications'],
          notificationDeliveryId: deliveryId,
        }),
      ],
    );
    const firstAttempt = vi.fn(async () => {
      throw new Error('provider offline');
    });
    const firstRuntime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      processNotificationDelivery: firstAttempt,
    });
    await firstRuntime.close();
    expect(firstAttempt).toHaveBeenCalledWith(deliveryId);
    await pool.query(`UPDATE "OutboxEvent" SET "availableAt" = now() WHERE id = $1`, [eventId]);

    const subscriber = createClient({ url: redisUrl });
    await subscriber.connect();
    const received = new Promise<Record<string, unknown>>((resolve) => {
      void subscriber.subscribe(REALTIME_CHANNEL, (raw) => {
        const event = JSON.parse(raw) as Record<string, unknown>;
        if (event.id === eventId) resolve(event);
      });
    });
    const recovered = vi.fn(async () => undefined);
    const restarted = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      processNotificationDelivery: recovered,
    });
    try {
      await expect(received).resolves.toMatchObject({
        id: eventId,
        clientId,
        domains: ['notifications'],
      });
      expect(await received).not.toHaveProperty('notificationDeliveryId');
      expect(recovered).toHaveBeenCalledWith(deliveryId);
      const persisted = await pool.query<{ status: string; attemptCount: number }>(
        `SELECT status, "attemptCount" FROM "OutboxEvent" WHERE id = $1`,
        [eventId],
      );
      expect(persisted.rows[0]).toEqual({ status: 'PUBLISHED', attemptCount: 2 });
    } finally {
      await restarted.close();
      await subscriber.quit();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  }, 30_000);
});
