import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { getPostRoundSummary } from './summary.js';
import { completePostRoundFollowUp, initializePostRoundFollowUp, listPostRoundFollowUps } from './followUp.js';
const completionSchema = z.object({ expectedVersion: z.number().int().positive(), outcome: z.enum(['APPROVED', 'DECLINED', 'PENDING', 'APPLICATION_NOT_COMPLETED', 'TECHNICAL_ISSUE', 'OTHER']).optional(), approvedLimitKnown: z.boolean().optional(), approvedLimit: z.number().positive().optional(), issuerReason: z.string().trim().max(500).optional(), unable: z.boolean().optional(), idempotencyKey: z.string().min(8).max(160).optional() });
const key = (req: import('express').Request, bodyKey?: string) => z.string().min(8).max(160).parse(req.get('idempotency-key') ?? bodyKey);
export function createPostRoundRouter(prisma: PrismaClient, authorization: AuthorizationService) {
  const router = Router();
  router.get('/client/rounds/:roundId/post-round', requireRole('CLIENT'), async (req, res, next) => { try { res.json(await getPostRoundSummary(prisma, req.params.roundId as string, req.auth!.clientId!)); } catch (error) { next(error); } });
  router.get('/consultant/clients/:clientId/rounds/:roundId/post-round', requireRole('CONSULTANT'), async (req, res, next) => { try { const clientId = req.params.clientId as string; if (!(await authorization.authorize(req.auth!, 'client.read', { type: 'client', clientId }))) throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this client'); res.json(await getPostRoundSummary(prisma, req.params.roundId as string, clientId, true)); } catch (error) { next(error); } });
  router.get('/client/rounds/:roundId/follow-ups', requireRole('CLIENT'), async (req, res, next) => { try { res.json({ items: await listPostRoundFollowUps(prisma, req.params.roundId as string, req.auth!.clientId!) }); } catch (error) { next(error); } });
  router.post('/client/rounds/:roundId/follow-ups/initialize', requireRole('CLIENT'), async (req, res, next) => { try { const result = await initializePostRoundFollowUp(prisma, { roundId: req.params.roundId as string, clientId: req.auth!.clientId!, actorId: req.auth!.userId, idempotencyKey: key(req, req.body?.idempotencyKey) }); res.status(result.replayed ? 200 : 201).json(result); } catch (error) { next(error); } });
  router.post('/client/follow-ups/:followUpId/complete', requireRole('CLIENT'), async (req, res, next) => { try { const body = completionSchema.parse(req.body); res.json(await completePostRoundFollowUp(prisma, { followUpId: req.params.followUpId as string, clientId: req.auth!.clientId!, actorId: req.auth!.userId, expectedVersion: body.expectedVersion, ...(body.outcome ? { outcome: body.outcome } : {}), ...(body.approvedLimitKnown !== undefined ? { approvedLimitKnown: body.approvedLimitKnown } : {}), ...(body.approvedLimit !== undefined ? { approvedLimit: body.approvedLimit } : {}), ...(body.issuerReason ? { issuerReason: body.issuerReason } : {}), ...(body.unable !== undefined ? { unable: body.unable } : {}), idempotencyKey: key(req, body.idempotencyKey) })); } catch (error) { next(error); } });
  return router;
}
