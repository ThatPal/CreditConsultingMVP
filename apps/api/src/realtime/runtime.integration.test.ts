import { createServer } from 'node:http';
import { createClient } from 'redis';
import { io as connect } from 'socket.io-client';
import pino from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { AuthPrincipal } from '../auth/types.js';
import { REALTIME_CHANNEL, startRealtimeRuntime } from './runtime.js';

function onceWithTimeout<T>(socket: ReturnType<typeof connect>, event: string, timeoutMs = 3000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (value: T) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

describe('canonical realtime authorization runtime', () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is required');
  const server = createServer();
  let runtime: Awaited<ReturnType<typeof startRealtimeRuntime>>;
  let url = '';
  const allowed = new Set(['authorized']);
  let resolveCalls = 0;
  const principal = (userId: string): AuthPrincipal => ({
    userId,
    email: `${userId}@example.test`,
    role: 'CLIENT',
    status: 'ACTIVE',
    clientId: '11111111-1111-4111-8111-111111111111',
  });

  beforeAll(async () => {
    runtime = await startRealtimeRuntime({
      server,
      redisUrl,
      webOrigin: 'http://localhost:5173',
      logger: pino({ enabled: false }),
      resolvePrincipal: async (headers) => {
        resolveCalls += 1;
        const id = headers['x-test-user'];
        return typeof id === 'string' ? principal(id) : null;
      },
      canSubscribe: async (subject, clientId) =>
        allowed.has(subject.userId) && clientId === subject.clientId,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    url = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => runtime.close());
  beforeEach(() => {
    allowed.add('authorized');
    resolveCalls = 0;
  });

  test('authorizes subscriptions and applies live revocation before delivery', async () => {
    const socket = connect(url, {
      extraHeaders: { 'x-test-user': 'authorized' },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out connecting realtime client')),
        3000,
      );
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.once('connect', () => clearTimeout(timer));
    });
    const clientId = principal('authorized').clientId!;
    const subscribed = await socket
      .timeout(3000)
      .emitWithAck('subscribe', { scope: 'client', clientId });
    expect(subscribed).toEqual({ ok: true, refetch: true });
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    expect(await redis.get(`credit:presence:authorized:${socket.id}`)).toBe('connected');
    const event = {
      id: crypto.randomUUID(),
      version: 1,
      type: 'resource.changed',
      occurredAt: new Date().toISOString(),
      clientId,
      domains: ['support'],
      refetch: true,
    };
    const received = onceWithTimeout(socket, 'resource.changed');
    await redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
    await expect(received).resolves.toMatchObject({ id: event.id, refetch: true });
    allowed.delete('authorized');
    const revoked = onceWithTimeout(socket, 'access.revoked');
    await redis.publish(REALTIME_CHANNEL, JSON.stringify({ ...event, id: crypto.randomUUID() }));
    await expect(revoked).resolves.toEqual({ clientId, refetch: true });
    socket.close();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await redis.get(`credit:presence:authorized:${socket.id}`)).toBeNull();
    await redis.quit();
  });

  test('reauthenticates and tells clients to refetch on reconnect', async () => {
    const connectOnce = async () => {
      const socket = connect(url, {
        extraHeaders: { 'x-test-user': 'authorized' },
        forceNew: true,
        transports: ['websocket'],
      });
      await onceWithTimeout(socket, 'connect');
      const result = await socket.timeout(3000).emitWithAck('subscribe', {
        scope: 'client',
        clientId: principal('authorized').clientId,
      });
      expect(result).toEqual({ ok: true, refetch: true });
      const disconnected = onceWithTimeout(socket, 'disconnect');
      socket.close();
      await disconnected;
    };
    await connectOnce();
    await connectOnce();
    expect(resolveCalls).toBeGreaterThanOrEqual(4);
  });

  test('denies an initially unauthorized subscription before protected delivery', async () => {
    const socket = connect(url, {
      extraHeaders: { 'x-test-user': 'unauthorized' },
      forceNew: true,
      transports: ['websocket'],
    });
    await onceWithTimeout(socket, 'connect');
    const clientId = principal('unauthorized').clientId!;
    const denied = await socket
      .timeout(3000)
      .emitWithAck('subscribe', { scope: 'client', clientId });
    expect(denied).toEqual({ ok: false, code: 'FORBIDDEN' });

    let delivered = false;
    socket.on('resource.changed', () => {
      delivered = true;
    });
    const redis = createClient({ url: redisUrl });
    await redis.connect();
    await redis.publish(
      REALTIME_CHANNEL,
      JSON.stringify({
        id: crypto.randomUUID(),
        version: 1,
        type: 'resource.changed',
        occurredAt: new Date().toISOString(),
        clientId,
        domains: ['support'],
        refetch: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(delivered).toBe(false);
    socket.close();
    await redis.quit();
  });
});
