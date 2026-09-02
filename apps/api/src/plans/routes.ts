import { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import { requireCapability, requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { approvePlan, clientSafeVersion, createPlanDraft, getPlanBuilder, revisePlanDraft } from './service.js';

const itemSchema = z.object({
  stableKey: z.string().min(1).max(80),
  type: z.enum(['ACTION', 'GUIDANCE', 'MILESTONE']),
  completionMode: z.enum(['ACKNOWLEDGEMENT', 'STRUCTURED_OUTCOME', 'CLIENT_REPORT_CONSULTANT_VERIFY', 'CONSULTANT_VERIFY', 'SYSTEM_VERIFY']),
  owner: z.enum(['CLIENT', 'CONSULTANT', 'SYSTEM']),
  clientTitle: z.string().min(1).max(160),
  clientBody: z.string().max(2000).nullable().optional(),
  consultantRationale: z.string().max(4000).nullable().optional(),
  sortOrder: z.number().int(),
  required: z.boolean().optional(),
  deepLink: z.string().max(500).nullable().optional(),
  outcomeSchema: z.record(z.string(), z.unknown()).optional(),
  manuallyProtected: z.boolean().optional(),
  pathKeys: z.array(z.string().min(1).max(80)).optional(),
});
const draftSchema = z.object({
  title: z.string().min(1).max(160),
  purpose: z.enum(['PREPARATION', 'NURTURE', 'POST_ROUND', 'MAJOR_READINESS']),
  sourceReviewId: z.string().uuid().nullable().optional(),
  sourceReviewVersion: z.number().int().positive().nullable().optional(),
  sourceGoalRevisionId: z.string().uuid().nullable().optional(),
  sourceProfileVersion: z.number().int().positive().nullable().optional(),
  items: z.array(itemSchema).min(1).max(200),
  paths: z.array(z.object({ key: z.string().min(1).max(80), clientLabel: z.string().min(1).max(160), internalLabel: z.string().max(500).nullable().optional(), status: z.enum(['AVAILABLE', 'ACTIVE', 'INACTIVE', 'RETIRED']), sortOrder: z.number().int() })).max(20).optional(),
  dependencies: z.array(z.object({ dependentKey: z.string(), prerequisiteKey: z.string(), groupKey: z.string().optional(), mode: z.enum(['ALL', 'ANY']).optional() })).max(500).optional(),
});

export function createPlanRouter(prisma: PrismaClient, authorization: AuthorizationService, recorder?: AuthorizationDenialRecorder) {
  const router = Router();
  router.get('/consultant/clients/:clientId/plan', requireRole('CONSULTANT'), requireCapability(authorization, 'review.read', 'clientId', undefined, recorder), async (req, res, next) => {
    try { res.json(await getPlanBuilder(prisma, req.params.clientId as string)); } catch (error) { next(error); }
  });
  router.post('/consultant/clients/:clientId/plans', requireRole('CONSULTANT'), requireCapability(authorization, 'review.publish', 'clientId', undefined, recorder), async (req, res, next) => {
    try { res.status(201).json(await createPlanDraft(prisma, req.params.clientId as string, draftSchema.parse(req.body) as Parameters<typeof createPlanDraft>[2])); } catch (error) { next(error); }
  });
  router.put('/consultant/clients/:clientId/plans/:planId', requireRole('CONSULTANT'), requireCapability(authorization, 'review.publish', 'clientId', undefined, recorder), async (req, res, next) => {
    try {
      const parsed = z.object({ expectedVersion: z.number().int().positive(), draft: draftSchema }).parse(req.body);
      const plan = await prisma.plan.findFirst({ where: { id: req.params.planId as string, clientId: req.params.clientId as string }, select: { id: true } });
      if (!plan) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
      res.json(await revisePlanDraft(prisma, plan.id, parsed.expectedVersion, parsed.draft as Parameters<typeof revisePlanDraft>[3]));
    } catch (error) { next(error); }
  });
  router.post('/consultant/clients/:clientId/plans/:planId/approve', requireRole('CONSULTANT'), requireCapability(authorization, 'review.publish', 'clientId', { requireStepUp: true }, recorder), async (req, res, next) => {
    try { res.json(await approvePlan(prisma, req.params.clientId as string, req.params.planId as string, req.auth!.userId)); } catch (error) { next(error); }
  });
  router.get('/client/plan', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const builder = await getPlanBuilder(prisma, req.auth!.clientId!);
      const version = builder.plan?.versions.find(({ status }) => ['ACTIVE', 'APPROVED', 'STALE'].includes(status));
      res.json({ plan: builder.plan && version ? { id: builder.plan.id, title: builder.plan.title, purpose: builder.plan.purpose, status: builder.plan.status, version: clientSafeVersion(version) } : null });
    } catch (error) { next(error); }
  });
  return router;
}
