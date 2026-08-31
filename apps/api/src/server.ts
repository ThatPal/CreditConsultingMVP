import { createServer } from 'node:http';
import { closeRedis, connectAndPingRedis, createRedisConnection } from '@credit/runtime';
import { createApp } from './app.js';
import { createAuthService } from './auth/authService.js';
import { createPrismaAuthStore } from './auth/prismaAuthStore.js';
import { loadEnv } from './config/env.js';
import { createPrismaGoalStore } from './goals/prismaGoalStore.js';
import { createGoalService } from './goals/service.js';
import { createPrismaServiceStore } from './services/prismaServiceStore.js';
import { createServiceCatalog } from './services/service.js';
import { createLogger } from './lib/logger.js';
import { createPrisma } from './lib/prisma.js';
import { createEmailProvider, createPasswordResetNotifier } from './notifications/emailProvider.js';
import { createBetterAuth } from './auth/betterAuth.js';

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);
const redis = createRedisConnection(env.REDIS_URL);
const emailProvider = createEmailProvider(env, logger);
const auth = createAuthService(
  createPrismaAuthStore(prisma),
  env,
  createPasswordResetNotifier(emailProvider),
);
const betterAuth = createBetterAuth(prisma, env, emailProvider);
const goals = createGoalService(createPrismaGoalStore(prisma));
const services = createServiceCatalog(createPrismaServiceStore(prisma));
const server = createServer(
  createApp(
    env,
    logger,
    auth,
    goals,
    services,
    prisma,
    {
      postgresql: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
      redis: async () => {
        if (!(await connectAndPingRedis(redis))) throw new Error('Redis ping failed');
      },
    },
    betterAuth,
  ),
);

server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close(async (error) => {
    await Promise.allSettled([prisma.$disconnect(), closeRedis(redis)]);
    if (error) {
      logger.error({ err: error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
