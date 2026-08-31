import { closeRedis, createRedisConnection, createRuntimeLogger } from '@credit/runtime';
import { Pool } from 'pg';
import { loadWorkerEnv } from './env.js';
import { startWorkerRuntime } from './runtime.js';

const env = loadWorkerEnv();
const logger = createRuntimeLogger('credit-worker', env);
const postgres = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
const redis = createRedisConnection(env.REDIS_URL);
startWorkerRuntime({
  logger,
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
        if (!redis.isOpen) await redis.connect();
      },
      check: async () => {
        if ((await redis.ping()) !== 'PONG') throw new Error('Redis ping failed');
      },
      close: async () => closeRedis(redis),
    },
  ],
}).catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Worker startup failed');
  await Promise.allSettled([postgres.end(), closeRedis(redis)]);
  process.exitCode = 1;
});
