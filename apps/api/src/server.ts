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
import { resolveBetterAuthPrincipal } from './auth/betterAuth.js';
import {
  createPrismaAuthorizationService,
  createRealtimeAuthorizationBridge,
} from './authorization/authorizationService.js';
import { startRealtimeRuntime } from './realtime/runtime.js';
import { createDocumentStorageRegistry } from './storage/documentStorage.js';
import { BullAIJobQueue, startDurableAIWorker } from './ai/bullTransport.js';
import { DurableAIRuntime } from './ai/durableRuntime.js';
import {
  Phase7DeterministicProvider,
  advanceDurablePhase7Pipeline,
  phase7Validators,
} from './ai/durableCreditReportPipeline.js';
import {
  enqueueSubmittedReviewPipeline,
  recoverSubmittedReviewPipelines,
} from './ai/submittedReviewPipeline.js';
import { strategyValidators } from './strategies/ai.js';
import { materializeSupportAIOutput, registerSupportAIProcesses, supportAIValidators } from './support/supportAI.js';

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
const documentStorage = createDocumentStorageRegistry();
const aiQueue = new BullAIJobQueue(env.REDIS_URL);
const aiRuntime = new DurableAIRuntime(prisma, aiQueue, new Phase7DeterministicProvider(), {
  ...phase7Validators,
  ...strategyValidators,
  ...supportAIValidators,
});
await registerSupportAIProcesses(aiRuntime);
const aiWorker = startDurableAIWorker(env.REDIS_URL, aiRuntime, (result) =>
  result.relatedEntityType === 'SupportCase'
    ? materializeSupportAIOutput(prisma, result)
    : advanceDurablePhase7Pipeline(aiRuntime, result),
);
await aiWorker.waitUntilReady();
await aiRuntime.reconstructAndEnqueue();
await recoverSubmittedReviewPipelines(prisma, documentStorage, aiRuntime);
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
    undefined,
    emailProvider,
    async (reviewId) => {
      try {
        return await enqueueSubmittedReviewPipeline(prisma, documentStorage, aiRuntime, reviewId);
      } catch (error) {
        logger.error(
          { err: error, reviewId },
          'Submitted Review processing enqueue deferred to recovery',
        );
        return null;
      }
    },
    aiRuntime,
  ),
);

const authorization = createRealtimeAuthorizationBridge(createPrismaAuthorizationService(prisma));
const realtime = await startRealtimeRuntime({
  server,
  redisUrl: env.REDIS_URL,
  webOrigin: env.WEB_ORIGIN,
  logger,
  resolvePrincipal: (headers) =>
    resolveBetterAuthPrincipal(betterAuth, prisma, headers, env.MFA_STEP_UP_TTL_MINUTES),
  canSubscribe: authorization.canSubscribeToClient,
});
server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API and realtime listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close(async (error) => {
    await Promise.allSettled([
      realtime.close(),
      aiWorker.close(),
      aiQueue.close(),
      prisma.$disconnect(),
      closeRedis(redis),
    ]);
    if (error) {
      logger.error({ err: error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }
  });
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
