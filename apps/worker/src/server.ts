import { closeRedis, createRedisConnection, createRuntimeLogger } from '@credit/runtime';
import { Pool } from 'pg';
import { loadWorkerEnv } from './env.js';
import { startWorkerRuntime } from './runtime.js';
import { startOutboxRuntime } from './outboxRuntime.js';
import {
  createNotificationDeliveryProcessor,
  type WorkerEmailSender,
} from './notificationDelivery.js';

const env = loadWorkerEnv();
const logger = createRuntimeLogger('credit-worker', env);
const postgres = new Pool({ connectionString: env.DATABASE_URL, max: 1 });
const redis = createRedisConnection(env.REDIS_URL);
if (env.EMAIL_PROVIDER !== 'CONSOLE')
  throw new Error(
    `${env.EMAIL_PROVIDER} email is configured but no worker transport is installed; refusing silent fallback`,
  );
const emailSender: WorkerEmailSender = {
  provider: 'CONSOLE',
  async send(message) {
    logger.info(
      { to: message.to, subject: message.subject },
      'Development notification email captured',
    );
    return { accepted: true };
  },
};
const outbox = await startOutboxRuntime({
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  logger,
  processNotificationDelivery: createNotificationDeliveryProcessor(postgres, emailSender),
});
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
      close: async () => {
        await Promise.allSettled([outbox.close(), closeRedis(redis)]);
      },
    },
  ],
}).catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Worker startup failed');
  await Promise.allSettled([outbox.close(), postgres.end(), closeRedis(redis)]);
  process.exitCode = 1;
});
