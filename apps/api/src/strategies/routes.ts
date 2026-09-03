import { Router } from 'express';
import { requireCapability, requireRole, type AuthorizationDenialRecorder } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { createStrategyDraft, getRoundStrategy } from './service.js';

export function createStrategyRouter(prisma: PrismaClient, authorization: AuthorizationService, recorder?: AuthorizationDenialRecorder) {
  const router = Router();
  router.get('/client/rounds/:roundId/strategy', requireRole('CLIENT'), async (req, res, next) => {
    try { res.json(await getRoundStrategy(prisma, req.params.roundId as string, req.auth!.clientId!, true)); } catch (error) { next(error); }
  });
  router.get('/consultant/clients/:clientId/rounds/:roundId/strategy', requireRole('CONSULTANT'), requireCapability(authorization, 'strategy.read', 'clientId', undefined, recorder), async (req, res, next) => {
    try { res.json(await getRoundStrategy(prisma, req.params.roundId as string, req.params.clientId as string)); } catch (error) { next(error); }
  });
  router.post('/consultant/clients/:clientId/rounds/:roundId/strategy/draft', requireRole('CONSULTANT'), requireCapability(authorization, 'strategy.manage', 'clientId', undefined, recorder), async (req, res, next) => {
    try { res.status(201).json(await createStrategyDraft(prisma, { roundId: req.params.roundId as string, clientId: req.params.clientId as string, actorId: req.auth!.userId })); } catch (error) { next(error); }
  });
  router.use('/admin', (_req, _res, next) => next(new AppError('FORBIDDEN', 403, 'Admin role alone does not grant strategy authority')));
  return router;
}
