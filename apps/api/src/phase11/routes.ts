import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate } from '../liveUpdates.js';
import { IdempotencyConflictError } from '../transactions/consequentialCommand.js';
import { createRound, getPhase11ClientView, getRoundClientView, pauseCycle, startOrResumeCycle, submitMajorApplicationCheck } from './service.js';

const keySchema = z.string().trim().min(8).max(160);
const majorCheckSchema = z.object({
  choice: z.enum(['NO', 'MORTGAGE', 'AUTO', 'STUDENT', 'OTHER_MAJOR_FINANCING', 'NOT_SURE']),
  intendedTiming: z.string().trim().min(1).max(160).nullable().optional(),
  clientContext: z.string().trim().max(1000).nullable().optional(),
  idempotencyKey: keySchema.optional(),
}).superRefine((value, context) => {
  if (value.choice !== 'NO' && !value.intendedTiming) context.addIssue({ code: 'custom', path: ['intendedTiming'], message: 'Tell us approximately when the major application may happen' });
});

function commandKey(req: import('express').Request, bodyKey?: string) {
  return keySchema.parse(req.get('idempotency-key') ?? bodyKey);
}

function mapCommandError(error: unknown): never {
  if (error instanceof IdempotencyConflictError) throw new AppError(error.code, 409, 'This command conflicts with an earlier request');
  throw error;
}

export function createPhase11Router(prisma: PrismaClient, authorization: AuthorizationService) {
  const router = Router();

  router.get('/client/seasonal-cycle', requireRole('CLIENT'), async (req, res, next) => {
    try { res.json(await getPhase11ClientView(prisma, req.auth!.clientId!)); } catch (error) { next(error); }
  });
  router.post('/client/seasonal-cycle/start-or-resume', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const result = await startOrResumeCycle(prisma, { clientId, actorId: req.auth!.userId, idempotencyKey: commandKey(req, req.body?.idempotencyKey) });
      publishLiveUpdate(clientId, 'application-cycles', 'credit-profile');
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { try { mapCommandError(error); } catch (mapped) { next(mapped); } }
  });
  router.post('/client/seasonal-cycle/:cycleId/pause', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const result = await pauseCycle(prisma, { clientId, actorId: req.auth!.userId, cycleId: req.params.cycleId as string, idempotencyKey: commandKey(req, req.body?.idempotencyKey) });
      publishLiveUpdate(clientId, 'application-cycles');
      res.json(result);
    } catch (error) { try { mapCommandError(error); } catch (mapped) { next(mapped); } }
  });
  router.post('/client/seasonal-cycle/:cycleId/rounds', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const result = await createRound(prisma, { clientId, actorId: req.auth!.userId, cycleId: req.params.cycleId as string, idempotencyKey: commandKey(req, req.body?.idempotencyKey) });
      publishLiveUpdate(clientId, 'application-cycles', 'services');
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { try { mapCommandError(error); } catch (mapped) { next(mapped); } }
  });
  router.get('/client/rounds/:roundId', requireRole('CLIENT'), async (req, res, next) => {
    try { res.json(await getRoundClientView(prisma, req.params.roundId as string, req.auth!.clientId!)); } catch (error) { next(error); }
  });
  router.post('/client/rounds/:roundId/major-check', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const parsed = majorCheckSchema.parse(req.body);
      const clientId = req.auth!.clientId!;
      const result = await submitMajorApplicationCheck(prisma, { clientId, actorId: req.auth!.userId, roundId: req.params.roundId as string, choice: parsed.choice, ...(parsed.intendedTiming !== undefined ? { intendedTiming: parsed.intendedTiming } : {}), ...(parsed.clientContext !== undefined ? { clientContext: parsed.clientContext } : {}), idempotencyKey: commandKey(req, parsed.idempotencyKey) });
      publishLiveUpdate(clientId, 'application-cycles', 'work-queue');
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { try { mapCommandError(error); } catch (mapped) { next(mapped); } }
  });
  router.get('/consultant/rounds/:roundId', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const round = await prisma.creditCardRound.findUnique({ where: { id: req.params.roundId as string }, select: { clientId: true } });
      if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
      const allowed = await authorization.authorize(req.auth!, 'client.read', { type: 'client', clientId: round.clientId });
      if (!allowed) throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this client');
      res.json(await getRoundClientView(prisma, req.params.roundId as string, round.clientId));
    } catch (error) { next(error); }
  });
  return router;
}
