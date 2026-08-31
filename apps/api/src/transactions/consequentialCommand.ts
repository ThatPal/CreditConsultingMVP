import { Prisma, type PrismaClient } from '../generated/prisma/client.js';

const prohibitedPayloadKey = /(password|token|secret|card.?number|file.?bytes|file.?content)/i;

export class IdempotencyConflictError extends Error {
  constructor(public readonly code: 'IDEMPOTENCY_IN_PROGRESS' | 'IDEMPOTENCY_KEY_REUSED') {
    super(code);
  }
}

export function assertSafeEventPayload(value: Prisma.InputJsonValue, path = 'payload'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeEventPayload(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (prohibitedPayloadKey.test(key)) throw new Error(`UNSAFE_EVENT_PAYLOAD:${path}.${key}`);
      if (item !== null) assertSafeEventPayload(item as Prisma.InputJsonValue, `${path}.${key}`);
    }
  }
}

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  clientId?: string | null;
  actorId?: string | null;
  source?: string;
  requestId?: string | null;
  correlationId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export async function appendAuditEvent(tx: Prisma.TransactionClient, input: AuditInput) {
  if (input.metadata) assertSafeEventPayload(input.metadata, 'audit.metadata');
  return tx.auditEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      clientId: input.clientId ?? null,
      actorId: input.actorId ?? null,
      source: input.source ?? 'APPLICATION',
      requestId: input.requestId ?? null,
      correlationId: input.correlationId ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

type CommandInput<TResult extends Prisma.InputJsonValue> = {
  idempotency: {
    scope: string;
    subjectId: string;
    operation: string;
    key: string;
    requestHash?: string | null;
    expiresAt?: Date | null;
  };
  audit: AuditInput | ((result: TResult) => AuditInput);
  outbox: {
    eventType: string;
    eventKey: string;
    aggregateType: string;
    aggregateId?: string | null;
    payload: Prisma.InputJsonValue | ((result: TResult) => Prisma.InputJsonValue);
    payloadVersion?: number;
  };
  mutate(tx: Prisma.TransactionClient): Promise<TResult>;
};

function idempotencyWhere(input: CommandInput<Prisma.InputJsonValue>['idempotency']) {
  return {
    scope_subjectId_operation_key: {
      scope: input.scope,
      subjectId: input.subjectId,
      operation: input.operation,
      key: input.key,
    },
  } as const;
}

async function resolveExisting<TResult extends Prisma.InputJsonValue>(
  prisma: PrismaClient,
  input: CommandInput<TResult>['idempotency'],
) {
  const existing = await prisma.idempotencyRecord.findUnique({ where: idempotencyWhere(input) });
  if (!existing) return null;
  if (existing.requestHash && input.requestHash && existing.requestHash !== input.requestHash)
    throw new IdempotencyConflictError('IDEMPOTENCY_KEY_REUSED');
  if (existing.status === 'COMPLETED') return existing.result as TResult;
  if (existing.status === 'PROCESSING')
    throw new IdempotencyConflictError('IDEMPOTENCY_IN_PROGRESS');
  return null;
}

export async function executeConsequentialCommand<TResult extends Prisma.InputJsonValue>(
  prisma: PrismaClient,
  input: CommandInput<TResult>,
): Promise<{ result: TResult; replayed: boolean }> {
  const prior = await resolveExisting<TResult>(prisma, input.idempotency);
  if (prior !== null) return { result: prior, replayed: true };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: idempotencyWhere(input.idempotency),
      });
      if (existing?.status === 'FAILED') {
        await tx.idempotencyRecord.update({
          where: { id: existing.id },
          data: { status: 'PROCESSING', errorCode: null, failedAt: null, startedAt: new Date() },
        });
      } else {
        await tx.idempotencyRecord.create({
          data: {
            ...input.idempotency,
            requestHash: input.idempotency.requestHash ?? null,
            expiresAt: input.idempotency.expiresAt ?? null,
          },
        });
      }

      const commandResult = await input.mutate(tx);
      assertSafeEventPayload(commandResult, 'idempotency.result');
      const audit = typeof input.audit === 'function' ? input.audit(commandResult) : input.audit;
      await appendAuditEvent(tx, audit);
      const payload =
        typeof input.outbox.payload === 'function'
          ? input.outbox.payload(commandResult)
          : input.outbox.payload;
      assertSafeEventPayload(payload, 'outbox.payload');
      await tx.outboxEvent.create({
        data: {
          eventType: input.outbox.eventType,
          eventKey: input.outbox.eventKey,
          aggregateType: input.outbox.aggregateType,
          aggregateId: input.outbox.aggregateId ?? null,
          payload,
          payloadVersion: input.outbox.payloadVersion ?? 1,
        },
      });
      await tx.idempotencyRecord.update({
        where: {
          scope_subjectId_operation_key: idempotencyWhere(input.idempotency)
            .scope_subjectId_operation_key,
        },
        data: { status: 'COMPLETED', result: commandResult, completedAt: new Date() },
      });
      return commandResult;
    });
    return { result, replayed: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await resolveExisting<TResult>(prisma, input.idempotency);
      if (duplicate !== null) return { result: duplicate, replayed: true };
      throw error;
    }
    await prisma.idempotencyRecord
      .create({
        data: {
          ...input.idempotency,
          requestHash: input.idempotency.requestHash ?? null,
          expiresAt: input.idempotency.expiresAt ?? null,
          status: 'FAILED',
          failedAt: new Date(),
          errorCode: 'COMMAND_FAILED',
        },
      })
      .catch((failure: unknown) => {
        if (!(failure instanceof Prisma.PrismaClientKnownRequestError && failure.code === 'P2002'))
          throw failure;
      });
    throw error;
  }
}
