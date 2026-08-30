import { randomUUID } from 'node:crypto';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AuthService } from './auth/authService.js';
import { authenticate } from './auth/middleware.js';
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

export function createApp(
  env: AppEnv,
  logger: Logger,
  auth?: AuthService,
  goals?: GoalService,
  services?: ServiceCatalog,
  prisma?: PrismaClient,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
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
    app.use(authenticate(auth, env.SESSION_COOKIE_NAME));
    app.use('/api/auth', createAuthRouter(auth, env));
    app.use('/api/me', createMeRouter(auth));
    if (goals) {
      app.use('/api/goals', createGoalRouter(goals));
      app.use('/api/v1/client/goals', createGoalRouter(goals));
    }
    if (services) {
      app.use('/api/services', createServiceRouter(services));
      app.use('/api/v1/client/services', createServiceRouter(services));
    }
    if (prisma) {
      app.use('/api/v1/reviews', createReviewRouter(prisma, auth));
      app.use('/api/v1/client/credit-profile', createCreditProfileRouter(prisma));
      app.use('/api/v1/major-readiness', createReadinessRouter(prisma, auth));
      app.use('/api/v1/readiness', createReadinessRouter(prisma, auth));
      app.use('/api/v1', createOperationsRouter(prisma, auth));
    }
  }
  app.get('/errors/test', (_req, _res, next) => next(new Error('Deliberate test error')));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
