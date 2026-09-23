import { seedSystemReferenceData } from '../apps/api/src/seeding/systemSeed.js';
import { domainEventBus } from '../apps/api/src/events/eventBus.js';
// Disposable, loopback-only integration harness. Never imported by the application.
import './entry-f1-guard.mjs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import pino from '../apps/api/node_modules/pino/pino.js';
import { createPrisma } from '../apps/api/src/lib/prisma.js';
import { loadEnv } from '../apps/api/src/config/env.js';
import { createApp } from '../apps/api/src/app.js';
import { startOutboxRuntime } from '../apps/worker/src/outboxRuntime.js';
import { startRealtimeRuntime } from '../apps/api/src/realtime/runtime.js';
import { createBetterAuth, resolveBetterAuthPrincipal } from '../apps/api/src/auth/betterAuth.js';
import { createAuthService } from '../apps/api/src/auth/authService.js';
import { createPrismaAuthStore } from '../apps/api/src/auth/prismaAuthStore.js';
import { createPrismaGoalStore } from '../apps/api/src/goals/prismaGoalStore.js';
import { createGoalService } from '../apps/api/src/goals/service.js';
import { createPrismaServiceStore } from '../apps/api/src/services/prismaServiceStore.js';
import { createServiceCatalog } from '../apps/api/src/services/service.js';
import type { EmailMessage, EmailProvider } from '../apps/api/src/notifications/emailProvider.js';

export async function startEntryHarness() {
  const prisma = createPrisma(process.env.DATABASE_URL!);
  await seedSystemReferenceData(prisma);
  const messages: EmailMessage[] = [];
  const provider: EmailProvider = {
    name: 'CONSOLE',
    async send(message) {
      messages.push(message);
      return { accepted: true, providerMessageId: randomUUID() };
    },
  };
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.DATABASE_URL,
    WEB_ORIGIN: 'http://127.0.0.1:5198',
    BETTER_AUTH_URL: 'http://127.0.0.1:3018',
    BETTER_AUTH_SECRET: 'entry-f1-disposable-auth-secret-not-for-production',
    SESSION_COOKIE_NAME: 'entry_f1_browser',
    AUTH_RATE_LIMIT_ENABLED: 'false',
    REDIS_URL: 'redis://127.0.0.1:6399',
  });
  const auth = createAuthService(createPrismaAuthStore(prisma), env, async () => undefined);
  const better = createBetterAuth(prisma, env, provider);
  const server = createServer(
    createApp(
      env,
      pino({ level: 'silent' }),
      auth,
      createGoalService(createPrismaGoalStore(prisma)),
      createServiceCatalog(createPrismaServiceStore(prisma)),
      prisma,
      undefined,
      better,
      undefined,
      provider,
    ),
  );
  await new Promise<void>((resolve) => server.listen(3018, '127.0.0.1', resolve));
  const observed = domainEventBus.subscribe((event) =>
    console.log('Event delivered to API:', event.domains.join(',')),
  );
  const realtime = await startRealtimeRuntime({
    server,
    redisUrl: env.REDIS_URL,
    webOrigin: env.WEB_ORIGIN,
    logger: pino({ level: 'silent' }),
    resolvePrincipal: (headers) =>
      resolveBetterAuthPrincipal(better, prisma, headers, env.MFA_STEP_UP_TTL_MINUTES),
    canSubscribe: async (actor, clientId) => actor.role === 'CLIENT' && actor.clientId === clientId,
  });
  async function deliver(clientId: string) {
    const events = await prisma.outboxEvent.findMany({
      where: {
        eventType: { in: ['client.goal.changed', 'goal-intake.resolved'] },
        payload: { path: ['clientId'], equals: clientId },
        publishedAt: null,
      },
    });
    console.log('Isolated outbox events selected:', events.length);
    if (!events.length) return;
    const worker = await startOutboxRuntime({
      databaseUrl: process.env.DATABASE_URL!,
      redisUrl: env.REDIS_URL,
      logger: pino({ level: 'silent' }),
      claimEventIds: events.map((e) => e.id),
      queueName: 'entry-f1-' + randomUUID(),
      pollIntervalMs: 50,
    });
    try {
      for (let n = 0; n < 100; n++) {
        await worker.publishBatch();
        if (
          (await prisma.outboxEvent.count({
            where: { id: { in: events.map((e) => e.id) }, publishedAt: null },
          })) === 0
        )
          return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('Outbox did not publish');
    } finally {
      await worker.close();
    }
  }
  return {
    prisma,
    messages,
    deliver,
    close: async () => {
      observed();
      await realtime.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e && e.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(e) : resolve())),
      );
      await prisma.$disconnect();
    },
  };
}
