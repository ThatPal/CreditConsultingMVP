import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import {
  assertSafeEventPayload,
  executeConsequentialCommand,
  IdempotencyConflictError,
} from './consequentialCommand.js';

let prisma: PrismaClient;
const suite = `sprint12-${randomUUID()}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for transaction tests');
  prisma = createPrisma(process.env.DATABASE_URL);
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.idempotencyRecord.deleteMany({ where: { scope: suite } });
  await prisma.outboxEvent.deleteMany({ where: { eventKey: { startsWith: suite } } });
  await prisma.auditEvent.deleteMany({ where: { action: { startsWith: suite } } });
  const clients = await prisma.client.findMany({
    where: { firstName: suite },
    select: { id: true },
  });
  await prisma.clientGoal.deleteMany({ where: { clientId: { in: clients.map(({ id }) => id) } } });
  await prisma.client.deleteMany({ where: { firstName: suite } });
  await prisma.$disconnect();
});

async function createClient() {
  return prisma.client.create({
    data: { firstName: suite, lastName: 'Transaction', termsAcceptedAt: new Date() },
  });
}

function command(clientId: string, key: string, fail = false) {
  return {
    idempotency: { scope: suite, subjectId: clientId, operation: 'CREATE_GOAL', key },
    audit: (result: { goalId: string }) => ({
      clientId,
      action: `${suite}.goal.created`,
      entityType: 'ClientGoal',
      entityId: result.goalId,
      correlationId: key,
      metadata: { goalType: 'BUSINESS_CREDIT' },
    }),
    outbox: {
      eventType: 'client-goal.created',
      eventKey: `${suite}:${key}`,
      aggregateType: 'ClientGoal',
      payload: (result: { goalId: string }) => ({ goalId: result.goalId, clientId }),
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
      if (fail) throw new Error('deliberate rollback');
      return { goalId: goal.id };
    },
  };
}

describe('consequential command transaction', () => {
  test('commits business state, audit, outbox and idempotency atomically and replays duplicates', async () => {
    const client = await createClient();
    const key = randomUUID();
    const first = await executeConsequentialCommand(prisma, command(client.id, key));
    const replay = await executeConsequentialCommand(prisma, command(client.id, key));

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ result: first.result, replayed: true });
    await expect(prisma.clientGoal.count({ where: { clientId: client.id } })).resolves.toBe(1);
    await expect(prisma.auditEvent.count({ where: { correlationId: key } })).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `${suite}:${key}` } }),
    ).resolves.toBe(1);
    await expect(
      prisma.idempotencyRecord.findUnique({
        where: {
          scope_subjectId_operation_key: {
            scope: suite,
            subjectId: client.id,
            operation: 'CREATE_GOAL',
            key,
          },
        },
      }),
    ).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  test('rolls back business state, audit and outbox together and records a safe failed attempt', async () => {
    const client = await createClient();
    const key = randomUUID();
    await expect(
      executeConsequentialCommand(prisma, command(client.id, key, true)),
    ).rejects.toThrow('deliberate rollback');
    await expect(prisma.clientGoal.count({ where: { clientId: client.id } })).resolves.toBe(0);
    await expect(prisma.auditEvent.count({ where: { correlationId: key } })).resolves.toBe(0);
    await expect(
      prisma.outboxEvent.count({ where: { eventKey: `${suite}:${key}` } }),
    ).resolves.toBe(0);
    await expect(
      prisma.idempotencyRecord.findFirst({ where: { scope: suite, key } }),
    ).resolves.toMatchObject({ status: 'FAILED', errorCode: 'COMMAND_FAILED' });
  });

  test('returns deterministic in-progress and request-hash conflict behavior', async () => {
    const client = await createClient();
    const key = randomUUID();
    await prisma.idempotencyRecord.create({
      data: {
        scope: suite,
        subjectId: client.id,
        operation: 'CREATE_GOAL',
        key,
        requestHash: 'one',
      },
    });
    await expect(
      executeConsequentialCommand(prisma, {
        ...command(client.id, key),
        idempotency: { ...command(client.id, key).idempotency, requestHash: 'one' },
      }),
    ).rejects.toMatchObject<IdempotencyConflictError>({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    await expect(
      executeConsequentialCommand(prisma, {
        ...command(client.id, key),
        idempotency: { ...command(client.id, key).idempotency, requestHash: 'two' },
      }),
    ).rejects.toMatchObject<IdempotencyConflictError>({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  test('rejects sensitive event payload keys', () => {
    expect(() => assertSafeEventPayload({ password: 'never' })).toThrow('UNSAFE_EVENT_PAYLOAD');
    expect(() => assertSafeEventPayload({ nested: { authToken: 'never' } })).toThrow(
      'UNSAFE_EVENT_PAYLOAD',
    );
  });
});
