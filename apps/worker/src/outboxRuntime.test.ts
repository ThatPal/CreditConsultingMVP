import { describe, expect, test } from 'vitest';
import {
  BULLMQ_JOB_ATTEMPTS,
  OUTBOX_MAX_CLAIMS,
  outboxFailureDisposition,
  outboxJobOptions,
  toClientEnvelope,
} from './outboxRuntime.js';

describe('outbox runtime contract', () => {
  test('creates a minimal refetch envelope with stable event identity', () => {
    const envelope = toClientEnvelope({
      id: '11111111-1111-4111-8111-111111111111',
      eventType: 'SUPPORT_UPDATED',
      aggregateId: 'case-1',
      payload: { clientId: '22222222-2222-4222-8222-222222222222', domains: ['support'] },
      payloadVersion: 1,
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
      attemptCount: 0,
    });
    expect(envelope).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      version: 1,
      type: 'resource.changed',
      refetch: true,
      domains: ['support'],
    });
    expect(outboxJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  });

  test('rejects payloads that cannot be safely routed', () => {
    expect(() =>
      toClientEnvelope({
        id: crypto.randomUUID(),
        eventType: 'INTERNAL',
        aggregateId: null,
        payload: { secret: 'must-not-leak' },
        payloadVersion: 1,
        createdAt: new Date(),
        attemptCount: 0,
      }),
    ).toThrow('OUTBOX_PAYLOAD_UNSAFE');
  });

  test('acknowledges governed global gateway events without publishing a client envelope', () => {
    expect(
      toClientEnvelope({
        id: crypto.randomUUID(),
        eventType: 'commerce.gateway.default.changed',
        aggregateId: crypto.randomUUID(),
        payload: { provider: 'STRIPE', domains: ['admin-payments', 'services'] },
        payloadVersion: 1,
        createdAt: new Date(),
        attemptCount: 0,
      }),
    ).toBeNull();
  });

  test('retries transient failures and dead-letters the fifth failed claim', () => {
    expect(OUTBOX_MAX_CLAIMS).toBe(5);
    expect(BULLMQ_JOB_ATTEMPTS).toBe(5);
    expect(outboxFailureDisposition(0)).toBe('PENDING');
    expect(outboxFailureDisposition(3)).toBe('PENDING');
    expect(outboxFailureDisposition(4)).toBe('FAILED');
    expect(outboxJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnFail: 1000,
    });
  });
});
