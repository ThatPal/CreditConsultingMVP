import { randomUUID } from 'node:crypto';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AuthService } from './auth/authService.js';
import { authenticate, authenticatePrincipal } from './auth/middleware.js';
import type { BetterAuthInstance } from './auth/betterAuth.js';
import { resolveBetterAuthPrincipal } from './auth/betterAuth.js';
import { createAuthFailureAuditMiddleware } from './auth/authAudit.js';
import { createAuthRouter, createMeRouter } from './auth/routes.js';
import type { AppEnv } from './config/env.js';
import { AppError, errorHandler, notFound } from './http/errors.js';
import { createGoalRouter } from './goals/routes.js';
import type { GoalService } from './goals/service.js';
import { createServiceRouter } from './services/routes.js';
import type { ServiceCatalog } from './services/service.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createReadinessRouter } from './readiness/routes.js';
import { createCreditProfileRouter, createReviewRouter } from './reviews/routes.js';
import { createOperationsRouter } from './operations/routes.js';
import {
  createPrismaAuthorizationDenialRecorder,
  createPrismaAuthorizationService,
} from './authorization/authorizationService.js';
import { createDocumentRouter } from './documents/routes.js';
import { createDocumentStorage } from './storage/documentStorage.js';

export type ReadinessChecks = {
  postgresql(): Promise<void>;
  redis(): Promise<void>;
};

export function createApp(
  env: AppEnv,
  logger: Logger,
  auth?: AuthService,
  goals?: GoalService,
  services?: ServiceCatalog,
  prisma?: PrismaClient,
  readiness?: ReadinessChecks,
  betterAuth?: BetterAuthInstance,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  if (betterAuth)
    app.all(
      '/api/auth/*splat',
      ...(prisma ? [createAuthFailureAuditMiddleware(prisma)] : []),
      toNodeHandler(betterAuth),
    );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers['x-request-id']?.toString() ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      customProps: (req) => ({ requestId: req.id }),
    }),
  );
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    if (!readiness)
      return res.status(503).json({
        status: 'not_ready',
        dependencies: { postgresql: 'unavailable', redis: 'unavailable' },
      });
    const [postgresql, redis] = await Promise.allSettled([
      readiness.postgresql(),
      readiness.redis(),
    ]);
    const dependencies = {
      postgresql: postgresql.status === 'fulfilled' ? 'ready' : 'unavailable',
      redis: redis.status === 'fulfilled' ? 'ready' : 'unavailable',
    } as const;
    const ready = dependencies.postgresql === 'ready' && dependencies.redis === 'ready';
    return res
      .status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not_ready', dependencies });
  });
  app.use((req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin && origin !== env.WEB_ORIGIN) {
        return next(new AppError('FORBIDDEN', 403, 'Request origin is not permitted'));
      }
    }
    next();
  });
  if (auth) {
    app.use(
      betterAuth && prisma
        ? authenticatePrincipal((headers) =>
            resolveBetterAuthPrincipal(betterAuth, prisma, headers, env.MFA_STEP_UP_TTL_MINUTES),
          )
        : authenticate(auth, env.SESSION_COOKIE_NAME),
    );
    if (!betterAuth) app.use('/api/auth', createAuthRouter(auth, env));
    app.use('/api/me', createMeRouter(auth, prisma));
    if (goals) {
      app.use('/api/goals', createGoalRouter(goals));
      app.use('/api/v1/client/goals', createGoalRouter(goals));
    }
    if (services) {
      app.use('/api/services', createServiceRouter(services));
      app.use('/api/v1/client/services', createServiceRouter(services));
    }
    if (prisma) {
      const authorization = createPrismaAuthorizationService(prisma);
      const denialRecorder = createPrismaAuthorizationDenialRecorder(prisma);
      app.use(
        '/api/v1/documents',
        createDocumentRouter(prisma, authorization, createDocumentStorage()),
      );
      app.use(
        '/api/v1/reviews',
        createReviewRouter(prisma, auth, undefined, authorization, denialRecorder),
      );
      app.use('/api/v1/client/credit-profile', createCreditProfileRouter(prisma));
      app.use(
        '/api/v1/major-readiness',
        createReadinessRouter(prisma, auth, authorization, denialRecorder),
      );
      app.use(
        '/api/v1/readiness',
        createReadinessRouter(prisma, auth, authorization, denialRecorder),
      );
      app.use('/api/v1', createOperationsRouter(prisma, auth, {}, authorization, denialRecorder));
    }
  }
  app.get('/errors/test', (_req, _res, next) => next(new Error('Deliberate test error')));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
