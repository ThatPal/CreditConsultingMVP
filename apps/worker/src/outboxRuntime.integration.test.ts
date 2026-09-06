import { createClient } from 'redis';
import { assertCreditDatabaseUrl } from '@credit/runtime';
import { Pool } from 'pg';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { REALTIME_CHANNEL, startOutboxRuntime } from './outboxRuntime.js';

describe('database to realtime outbox pipeline', () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required');
  const pool = new Pool({ connectionString: assertCreditDatabaseUrl(databaseUrl) });

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
    let resolveReceived!: (event: Record<string, unknown>) => void;
    let rejectReceived!: (error: Error) => void;
    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      resolveReceived = resolve;
      rejectReceived = reject;
    });
    const timer = setTimeout(
      () => rejectReceived(new Error('Timed out waiting for outbox dispatch')),
      5000,
    );
    await subscriber.subscribe(REALTIME_CHANNEL, (raw) => {
      const event = JSON.parse(raw) as Record<string, unknown>;
      if (event.id !== eventId) return;
      clearTimeout(timer);
      resolveReceived(event);
    });
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload, "createdAt")
       VALUES ($1, 'SUPPORT_UPDATED', $2, 'SupportCase', 'case-1', $3::jsonb, '1900-01-01T00:00:00Z')`,
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
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
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

  test('fails closed immediately for an unsafe poison event', async () => {
    const eventId = crypto.randomUUID();
    const eventKey = `sprint-3.1-c1-poison:${eventId}`;
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload, "createdAt")
       VALUES ($1, 'INTERNAL_UNSAFE', $2, 'Internal', 'poison-1', $3::jsonb, '1900-01-01T00:00:00Z')`,
      [eventId, eventKey, JSON.stringify({ internalOnly: true })],
    );
    const runtime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
    });
    try {
      const persisted = await pool.query<{
        status: string;
        attemptCount: number;
        lastErrorCode: string | null;
      }>(`SELECT status, "attemptCount", "lastErrorCode" FROM "OutboxEvent" WHERE id = $1`, [
        eventId,
      ]);
      expect(persisted.rows[0]).toEqual({
        status: 'FAILED',
        attemptCount: 1,
        lastErrorCode: 'OUTBOX_PAYLOAD_UNSAFE',
      });
    } finally {
      await runtime.close();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  }, 30_000);

  test('resumes durable email delivery after restart without exposing delivery identity realtime', async () => {
    const eventId = crypto.randomUUID();
    const deliveryId = crypto.randomUUID();
    const clientId = '22222222-2222-4222-8222-222222222222';
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", "aggregateId", payload, "createdAt")
       VALUES ($1, 'notification.created', $2, 'Notification', $3, $4::jsonb, '1900-01-01T00:00:00Z')`,
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
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
    });
    await firstRuntime.close();
    expect(firstAttempt).toHaveBeenCalledWith(deliveryId);
    await pool.query(`UPDATE "OutboxEvent" SET "availableAt" = now() WHERE id = $1`, [eventId]);

    const subscriber = createClient({ url: redisUrl });
    await subscriber.connect();
    let resolveReceived!: (event: Record<string, unknown>) => void;
    const received = new Promise<Record<string, unknown>>((resolve) => {
      resolveReceived = resolve;
    });
    await subscriber.subscribe(REALTIME_CHANNEL, (raw) => {
      const event = JSON.parse(raw) as Record<string, unknown>;
      if (event.id === eventId) resolveReceived(event);
    });
    const recovered = vi.fn(async () => undefined);
    const restarted = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      processNotificationDelivery: recovered,
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
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

  test('serializes overlapping polls and preserves one durable claim', async () => {
    const eventId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", payload, "availableAt")
       VALUES ($1, 'commerce.gateway.default.changed', $2, 'PaymentGatewayConfig',
         $3::jsonb, now() + interval '1 hour')`,
      [eventId, `wave1-overlap:${eventId}`, JSON.stringify({ domains: ['services'] })],
    );
    const runtime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
    });
    try {
      await pool.query(`UPDATE "OutboxEvent" SET "availableAt" = now() WHERE id = $1`, [eventId]);
      await Promise.all([runtime.publishBatch(), runtime.publishBatch()]);
      const persisted = await pool.query<{ status: string; attemptCount: number }>(
        `SELECT status, "attemptCount" FROM "OutboxEvent" WHERE id = $1`,
        [eventId],
      );
      expect(persisted.rows[0]).toEqual({ status: 'PUBLISHED', attemptCount: 1 });
    } finally {
      await runtime.close();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  });

  test('reclaims an expired lease after a worker crash and advances the durable attempt', async () => {
    const eventId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO "OutboxEvent"
         (id, "eventType", "eventKey", "aggregateType", payload, status,
          "attemptCount", "claimToken", "claimExpiresAt")
       VALUES ($1, 'commerce.gateway.default.changed', $2, 'PaymentGatewayConfig',
         $3::jsonb, 'PROCESSING', 1, $4::uuid, now() - interval '1 second')`,
      [
        eventId,
        `wave1-expired-lease:${eventId}`,
        JSON.stringify({ domains: ['services'] }),
        crypto.randomUUID(),
      ],
    );
    const runtime = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
      queueName: `credit-outbox-test-${eventId}`,
      claimEventIds: [eventId],
    });
    try {
      const persisted = await pool.query<{
        status: string;
        attemptCount: number;
        claimToken: string | null;
      }>(`SELECT status, "attemptCount", "claimToken" FROM "OutboxEvent" WHERE id = $1`, [
        eventId,
      ]);
      expect(persisted.rows[0]).toEqual({
        status: 'PUBLISHED',
        attemptCount: 2,
        claimToken: null,
      });
    } finally {
      await runtime.close();
      await pool.query(`DELETE FROM "OutboxEvent" WHERE id = $1`, [eventId]);
    }
  });
});
