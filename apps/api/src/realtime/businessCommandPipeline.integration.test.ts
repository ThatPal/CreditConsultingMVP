import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createClient } from 'redis';
import { io as connect } from 'socket.io-client';
import pino from 'pino';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { REALTIME_CHANNEL, startOutboxRuntime } from '../../../worker/src/outboxRuntime.js';
import type { AuthPrincipal } from '../auth/types.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPrisma } from '../lib/prisma.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { startRealtimeRuntime } from './runtime.js';

function onceWithTimeout<T>(socket: ReturnType<typeof connect>, event: string, timeoutMs = 8000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe('business command to authorized realtime refetch', () => {
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL;
  if (!databaseUrl || !redisUrl) throw new Error('DATABASE_URL and REDIS_URL are required');
  const suite = `sprint-3.1-c1-${randomUUID()}`;
  const server = createServer();
  let prisma: PrismaClient;
  let realtime: Awaited<ReturnType<typeof startRealtimeRuntime>>;
  let url = '';

  beforeAll(async () => {
    prisma = createPrisma(databaseUrl);
    await prisma.$connect();
    realtime = await startRealtimeRuntime({
      server,
      redisUrl,
      webOrigin: 'http://localhost:5173',
      logger: pino({ enabled: false }),
      resolvePrincipal: async (headers) => {
        const userId = headers['x-test-user'];
        const clientId = headers['x-test-client'];
        if (typeof userId !== 'string' || typeof clientId !== 'string') return null;
        return {
          userId,
          email: `${userId}@example.test`,
          role: 'CLIENT',
          status: 'ACTIVE',
          clientId,
        } satisfies AuthPrincipal;
      },
      canSubscribe: async (principal, clientId) =>
        principal.userId === 'authorized' && principal.clientId === clientId,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    const clients = await prisma.client.findMany({
      where: { firstName: suite },
      select: { id: true },
    });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: suite } });
    await prisma.outboxEvent.deleteMany({ where: { eventKey: { startsWith: suite } } });
    await prisma.auditEvent.deleteMany({ where: { action: { startsWith: suite } } });
    await prisma.clientGoal.deleteMany({
      where: { clientId: { in: clients.map(({ id }) => id) } },
    });
    await prisma.client.deleteMany({ where: { id: { in: clients.map(({ id }) => id) } } });
    await realtime.close();
    await prisma.$disconnect();
  });

  async function createBusinessClient() {
    return prisma.client.create({
      data: { firstName: suite, lastName: 'Realtime', termsAcceptedAt: new Date() },
    });
  }

  function goalCommand(clientId: string, key: string) {
    return {
      idempotency: { scope: suite, subjectId: clientId, operation: 'CREATE_GOAL', key },
      audit: (result: { goalId: string }) => ({
        clientId,
        action: `${suite}.goal.created`,
        entityType: 'ClientGoal',
        entityId: result.goalId,
        correlationId: key,
      }),
      outbox: {
        eventType: 'client-goal.created',
        eventKey: `${suite}:${key}`,
        aggregateType: 'ClientGoal',
        payload: (result: { goalId: string }) => ({
          clientId,
          domains: ['credit-profile'],
          goalId: result.goalId,
        }),
      },
      mutate: async (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => {
        const goal = await tx.clientGoal.create({
          data: {
            clientId,
            goalType: 'BUSINESS_CREDIT',
            scope: 'BUSINESS',
            priority: 'PRIMARY',
          },
        });
        return { goalId: goal.id };
      },
    };
  }

  async function connectAuthorized(clientId: string) {
    const socket = connect(url, {
      extraHeaders: { 'x-test-user': 'authorized', 'x-test-client': clientId },
      forceNew: true,
      transports: ['websocket'],
    });
    await onceWithTimeout(socket, 'connect');
    await expect(
      socket.timeout(3000).emitWithAck('subscribe', { scope: 'client', clientId }),
    ).resolves.toEqual({ ok: true, refetch: true });
    return socket;
  }

  test('commits once, dispatches the same durable event, and safely refetches authoritative state', async () => {
    const client = await createBusinessClient();
    const key = randomUUID();
    const socket = await connectAuthorized(client.id);
    const command = goalCommand(client.id, key);
    const first = await executeConsequentialCommand(prisma, command);
    const replay = await executeConsequentialCommand(prisma, command);
    expect(replay).toEqual({ result: first.result, replayed: true });

    const outbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: `${suite}:${key}` },
    });
    // The accumulated suite intentionally shares a database and may contain
    // unrelated pending fixtures. Put this proof event at the front of the
    // production worker's bounded oldest-first claim without deleting or
    // mutating another test's durable state.
    await prisma.outboxEvent.update({
      where: { id: outbox.id },
      data: { createdAt: new Date('2000-01-01T00:00:00.000Z') },
    });
    expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { correlationId: key } })).toBe(1);
    expect(await prisma.outboxEvent.count({ where: { eventKey: `${suite}:${key}` } })).toBe(1);

    const received = onceWithTimeout<Record<string, unknown>>(socket, 'resource.changed');
    const worker = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
    });
    try {
      await expect(received).resolves.toMatchObject({
        id: outbox.id,
        clientId: client.id,
        domains: ['credit-profile'],
        refetch: true,
      });
      const envelope = await received;
      expect(envelope).not.toHaveProperty('goalId');
      expect(envelope).not.toHaveProperty('payload');
      await expect(
        prisma.clientGoal.findUnique({ where: { id: first.result.goalId } }),
      ).resolves.toMatchObject({ clientId: client.id, goalType: 'BUSINESS_CREDIT' });
      await expect(
        prisma.outboxEvent.findUnique({ where: { id: outbox.id } }),
      ).resolves.toMatchObject({ status: 'PUBLISHED', attemptCount: 1 });

      const redis = createClient({ url: redisUrl });
      await redis.connect();
      expect(await redis.publish(REALTIME_CHANNEL, JSON.stringify(envelope))).toBeGreaterThan(0);
      await redis.quit();
      expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(1);
      expect(await prisma.auditEvent.count({ where: { correlationId: key } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { eventKey: `${suite}:${key}` } })).toBe(1);
    } finally {
      await worker.close();
      socket.close();
    }
  }, 15_000);

  test('publishes a pending durable event after worker restart without rerunning the command', async () => {
    const client = await createBusinessClient();
    const key = randomUUID();
    const first = await executeConsequentialCommand(prisma, goalCommand(client.id, key));
    const outbox = await prisma.outboxEvent.findUniqueOrThrow({
      where: { eventKey: `${suite}:${key}` },
    });
    await prisma.outboxEvent.update({
      where: { id: outbox.id },
      data: {
        availableAt: new Date(Date.now() + 60_000),
        createdAt: new Date('2000-01-01T00:00:00.000Z'),
      },
    });

    const firstWorker = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
    });
    await firstWorker.close();
    await expect(
      prisma.outboxEvent.findUnique({ where: { id: outbox.id } }),
    ).resolves.toMatchObject({
      status: 'PENDING',
      attemptCount: 0,
    });

    await prisma.outboxEvent.update({
      where: { id: outbox.id },
      data: { availableAt: new Date() },
    });
    const socket = await connectAuthorized(client.id);
    const received = onceWithTimeout<Record<string, unknown>>(socket, 'resource.changed');
    const restartedWorker = await startOutboxRuntime({
      databaseUrl,
      redisUrl,
      logger: pino({ enabled: false }),
      pollIntervalMs: 60_000,
    });
    try {
      await expect(received).resolves.toMatchObject({ id: outbox.id, clientId: client.id });
      expect(await prisma.clientGoal.count({ where: { id: first.result.goalId } })).toBe(1);
      expect(await prisma.auditEvent.count({ where: { correlationId: key } })).toBe(1);
      expect(await prisma.outboxEvent.count({ where: { eventKey: `${suite}:${key}` } })).toBe(1);
    } finally {
      await restartedWorker.close();
      socket.close();
    }
  }, 15_000);
});
