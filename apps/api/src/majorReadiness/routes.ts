import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { DurableAIRuntime } from '../ai/durableRuntime.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate } from '../liveUpdates.js';
import {
  approveDecision,
  approveRecommendation,
  clearRestrictions,
  draftRecommendation,
  enqueueRecommendationPreparation,
  finalizeCase,
  getCase,
  recordMajorApplicationOutcome,
  startCase,
  updateCase,
} from './service.js';
const key = (req: import('express').Request, body?: string) =>
  z
    .string()
    .min(8)
    .max(160)
    .parse(req.get('idempotency-key') ?? body);
const details = z.object({
  intentType: z.string().trim().min(1).max(80),
  targetTiming: z.string().trim().max(160).optional(),
  clientContext: z.string().trim().max(1000).optional(),
  expectedVersion: z.number().int().positive().optional(),
  idempotencyKey: z.string().optional(),
});
export function createMajorReadinessRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  aiRuntime?: DurableAIRuntime,
) {
  const router = Router();
  router.get('/client/case', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await getCase(prisma, req.auth!.clientId!));
    } catch (e) {
      next(e);
    }
  });
  router.get('/client/cases/:caseId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await getCase(prisma, req.auth!.clientId!, req.params.caseId as string));
    } catch (e) {
      next(e);
    }
  });
  router.post('/client/cases', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const b = details.omit({ expectedVersion: true }).parse(req.body);
      const clientId = req.auth!.clientId!;
      const out = await startCase(prisma, {
        clientId,
        actorId: req.auth!.userId,
        intentType: b.intentType,
        targetTiming: b.targetTiming,
        clientContext: b.clientContext,
        idempotencyKey: key(req, b.idempotencyKey),
      });
      publishLiveUpdate(clientId, 'major-readiness', 'work-queue');
      res.status(out.replayed ? 200 : 201).json(out);
    } catch (e) {
      next(e);
    }
  });
  router.put('/client/cases/:caseId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const b = details.extend({ expectedVersion: z.number().int().positive() }).parse(req.body);
      const clientId = req.auth!.clientId!;
      const out = await updateCase(prisma, {
        caseId: req.params.caseId as string,
        clientId,
        actorId: req.auth!.userId,
        expectedVersion: b.expectedVersion,
        intentType: b.intentType,
        targetTiming: b.targetTiming,
        clientContext: b.clientContext,
        idempotencyKey: key(req, b.idempotencyKey),
      });
      publishLiveUpdate(clientId, 'major-readiness', 'work-queue');
      res.json(out);
    } catch (e) {
      next(e);
    }
  });
  const guard = async (
    req: import('express').Request,
    capability: 'client.read' | 'client.manage',
  ) => {
    const clientId = req.params.clientId as string;
    if (!(await authorization.authorize(req.auth!, capability, { type: 'client', clientId })))
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this client');
    return clientId;
  };
  router.get(
    '/consultant/clients/:clientId/cases/:caseId',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.read');
        res.json(await getCase(prisma, clientId, req.params.caseId as string, true));
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/prepare-ai',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        if (!aiRuntime) throw new AppError('AI_UNAVAILABLE', 503, 'AI preparation is unavailable; use the manual recommendation path');
        const clientId = await guard(req, 'client.manage');
        const view = await getCase(prisma, clientId, req.params.caseId as string, true);
        if (!view.case) throw new AppError('MAJOR_READINESS_CASE_NOT_FOUND', 404, 'Case not found');
        const job = await enqueueRecommendationPreparation(aiRuntime, { caseId: view.case.id, clientId, caseVersion: view.case.version, profileStateId: view.case.profileStateId });
        res.status(202).json({ jobId: job.id, status: job.status, authority: 'DRAFT_ONLY' });
      } catch (e) { next(e); }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/recommendations',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const b = z
          .object({
            type: z.enum(['PROCEED_NOW', 'PREPARE_FIRST', 'REASSESS_LATER']),
            clientSafeExplanation: z.string().min(1).max(3000),
            internalRationale: z.string().max(3000).optional(),
            idempotencyKey: z.string().optional(),
          })
          .parse(req.body);
        res
          .status(201)
          .json(
            await draftRecommendation(prisma, {
              caseId: req.params.caseId as string,
              clientId,
              actorId: req.auth!.userId,
              ...b,
              idempotencyKey: key(req, b.idempotencyKey),
            }),
          );
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/recommendations/:recommendationId/approve',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const out = await approveRecommendation(prisma, {
          caseId: req.params.caseId as string,
          recommendationId: req.params.recommendationId as string,
          clientId,
          actorId: req.auth!.userId,
          idempotencyKey: key(req, req.body?.idempotencyKey),
        });
        publishLiveUpdate(clientId, 'major-readiness', 'plan', 'work-queue');
        res.json(out);
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/decisions',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const b = z
          .object({
            type: z.enum(['NO_RESTRICTION', 'PAUSE_CARD_ACTIVITY', 'LIMIT_CARD_ACTIVITY']),
            clientSafeExplanation: z.string().min(1).max(3000),
            internalRationale: z.string().max(3000).optional(),
            idempotencyKey: z.string().optional(),
          })
          .parse(req.body);
        const out = await approveDecision(prisma, {
          caseId: req.params.caseId as string,
          clientId,
          actorId: req.auth!.userId,
          ...b,
          idempotencyKey: key(req, b.idempotencyKey),
        });
        publishLiveUpdate(
          clientId,
          'major-readiness',
          'application-cycles',
          'strategy',
          'appointments',
          'live-sessions',
        );
        res.status(201).json(out);
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/restrictions/clear',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const b = z
          .object({ reason: z.string().min(3).max(1000), idempotencyKey: z.string().optional() })
          .parse(req.body);
        const out = await clearRestrictions(prisma, {
          caseId: req.params.caseId as string,
          clientId,
          actorId: req.auth!.userId,
          reason: b.reason,
          idempotencyKey: key(req, b.idempotencyKey),
        });
        publishLiveUpdate(
          clientId,
          'major-readiness',
          'application-cycles',
          'strategy',
          'appointments',
          'live-sessions',
        );
        res.json(out);
      } catch (e) {
        next(e);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/outcome',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const b = z.object({ outcome: z.string().trim().min(1).max(120), submittedAt: z.coerce.date().optional(), idempotencyKey: z.string().optional() }).parse(req.body);
        const out = await recordMajorApplicationOutcome(prisma, { caseId: req.params.caseId as string, clientId, actorId: req.auth!.userId, outcome: b.outcome, ...(b.submittedAt ? { submittedAt: b.submittedAt } : {}), idempotencyKey: key(req, b.idempotencyKey) });
        publishLiveUpdate(clientId, 'major-readiness', 'work-queue');
        res.json(out);
      } catch (e) { next(e); }
    },
  );
  router.post(
    '/consultant/clients/:clientId/cases/:caseId/finalize',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const clientId = await guard(req, 'client.manage');
        const out = await finalizeCase(prisma, {
          caseId: req.params.caseId as string,
          clientId,
          actorId: req.auth!.userId,
          idempotencyKey: key(req, req.body?.idempotencyKey),
        });
        publishLiveUpdate(clientId, 'major-readiness', 'journey', 'application-cycles');
        res.json(out);
      } catch (e) {
        next(e);
      }
    },
  );
  return router;
}
