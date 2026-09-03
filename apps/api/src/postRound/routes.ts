import { Router } from 'express';
import { requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { getPostRoundSummary } from './summary.js';
export function createPostRoundRouter(prisma: PrismaClient, authorization: AuthorizationService) {
  const router = Router();
  router.get('/client/rounds/:roundId/post-round', requireRole('CLIENT'), async (req, res, next) => { try { res.json(await getPostRoundSummary(prisma, req.params.roundId as string, req.auth!.clientId!)); } catch (error) { next(error); } });
  router.get('/consultant/clients/:clientId/rounds/:roundId/post-round', requireRole('CONSULTANT'), async (req, res, next) => { try { const clientId = req.params.clientId as string; if (!(await authorization.authorize(req.auth!, 'client.read', { type: 'client', clientId }))) throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this client'); res.json(await getPostRoundSummary(prisma, req.params.roundId as string, clientId, true)); } catch (error) { next(error); } });
  return router;
}
