import pino from 'pino';
import { createClient, type RedisClientType } from 'redis';
import { z } from 'zod';

export const runtimeEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol), {
    message: 'REDIS_URL must use redis:// or rediss://',
  }),
});
export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function createRuntimeLogger(
  service: string,
  env: Pick<RuntimeEnv, 'LOG_LEVEL' | 'NODE_ENV'>,
) {
  return pino({
    level: env.LOG_LEVEL,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.secret',
      '*.url',
    ],
    base: { service, environment: env.NODE_ENV },
  });
}

export type RedisConnection = RedisClientType;

export function assertCreditDatabaseUrl(databaseUrl: string) {
  const database = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
  if (database !== 'credit_strategy' && !database.startsWith('credit_strategy_'))
    throw new Error(
      'DATABASE_URL must target a Credit Platform database named credit_strategy or credit_strategy_*',
    );
  return databaseUrl;
}
export function createRedisConnection(redisUrl: string): RedisConnection {
  const client = createClient({
    url: redisUrl,
    socket: { connectTimeout: 2_000, reconnectStrategy: false },
  });
  client.on('error', () => undefined);
  return client;
}
export async function connectAndPingRedis(client: RedisConnection) {
  if (!client.isOpen) await client.connect();
  return (await client.ping()) === 'PONG';
}
export async function closeRedis(client: RedisConnection) {
  if (client.isOpen) await client.quit();
}
