import { Router } from 'express';
import { requireCapability, requireRole, type AuthorizationDenialRecorder } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { z } from 'zod';
import { createStrategyDraft, getRoundStrategy, saveStrategySequence, setStrategyCandidate, strategyCatalog } from './service.js';

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
  router.get('/consultant/clients/:clientId/strategy/catalog', requireRole('CONSULTANT'), requireCapability(authorization, 'strategy.read', 'clientId', undefined, recorder), async (req, res, next) => {
    try { const search = z.string().trim().max(100).optional().parse(req.query.search); res.json({ products: await strategyCatalog(prisma, search) }); } catch (error) { next(error); }
  });
  router.put('/consultant/clients/:clientId/strategies/:strategyId/candidates/:productId', requireRole('CONSULTANT'), requireCapability(authorization, 'strategy.manage', 'clientId', undefined, recorder), async (req, res, next) => {
    try {
      const body = z.object({ expectedStrategyVersion: z.number().int().positive(), disposition: z.enum(['SHORTLISTED', 'EXCLUDED']), role: z.enum(['PLANNED', 'ALTERNATIVE', 'CONDITIONAL']).optional(), internalRationale: z.string().max(2000).optional(), clientSafeReason: z.string().max(1000).optional() }).parse(req.body);
      res.json(await setStrategyCandidate(prisma, { strategyId: req.params.strategyId as string, productId: req.params.productId as string, clientId: req.params.clientId as string, actorId: req.auth!.userId, expectedStrategyVersion: body.expectedStrategyVersion, disposition: body.disposition, ...(body.role !== undefined ? { role: body.role } : {}), ...(body.internalRationale !== undefined ? { internalRationale: body.internalRationale } : {}), ...(body.clientSafeReason !== undefined ? { clientSafeReason: body.clientSafeReason } : {}) }));
    } catch (error) { next(error); }
  });
  router.put('/consultant/clients/:clientId/strategies/:strategyId/sequence', requireRole('CONSULTANT'), requireCapability(authorization, 'strategy.manage', 'clientId', undefined, recorder), async (req, res, next) => {
    try {
      const objectRule = z.record(z.string(), z.unknown());
      const body = z.object({ expectedStrategyVersion: z.number().int().positive(), items: z.array(z.object({ candidateId: z.string().uuid(), sequence: z.number().int().positive(), role: z.enum(['PLANNED', 'ALTERNATIVE', 'CONDITIONAL']), timingRule: objectRule, dependencyRule: objectRule, stopRule: objectRule, reconsiderationRule: objectRule, internalRationale: z.string().min(1).max(2000), clientSafeReason: z.string().min(1).max(1000) })) }).parse(req.body);
      res.json(await saveStrategySequence(prisma, { strategyId: req.params.strategyId as string, clientId: req.params.clientId as string, ...body }));
    } catch (error) { next(error); }
  });
  router.use('/admin', (_req, _res, next) => next(new AppError('FORBIDDEN', 403, 'Admin role alone does not grant strategy authority')));
  return router;
}
