import { closeRedis, createRedisConnection } from '@credit/runtime';
import { Pool } from 'pg';
import pino from 'pino';
import { describe, expect, test } from 'vitest';
import { startWorkerRuntime } from './runtime.js';

describe('worker infrastructure boundary', () => {
  test('becomes ready against PostgreSQL and Redis and closes both cleanly', async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const redisUrl = process.env.REDIS_URL;
    if (!databaseUrl || !redisUrl)
      throw new Error('DATABASE_URL and REDIS_URL are required for worker integration tests');

    const postgres = new Pool({ connectionString: databaseUrl, max: 1 });
    const redis = createRedisConnection(redisUrl);
    const runtime = await startWorkerRuntime({
      logger: pino({ level: 'silent' }),
      dependencies: [
        {
          name: 'postgresql',
          connect: async () => undefined,
          check: async () => {
            await postgres.query('SELECT 1');
          },
          close: async () => {
            await postgres.end();
          },
        },
        {
          name: 'redis',
          connect: async () => {
            await redis.connect();
          },
          check: async () => {
            expect(await redis.ping()).toBe('PONG');
          },
          close: async () => closeRedis(redis),
        },
      ],
    });

    await runtime.stop('test');
    expect(redis.isOpen).toBe(false);
  });
});
