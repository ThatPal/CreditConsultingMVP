import { clientResponseForm } from './outcomes.js';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import { requireCapability, requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import {
  approvePlan,
  getPlanVersionHistory,
  getClientPlan,
  getResponseDraft,
  saveResponseDraft,
  getPlanItemHistory,
  createPlanDraft,
  executePlanItem,
  getPlanBuilder,
  listClientPlans,
  getPlanSourcePreview,
  reconcilePlanSources,
  revisePlanDraft,
  verifyPlanItem,
} from './service.js';

const itemSchema = z.object({
  stableKey: z.string().min(1).max(80),
  type: z.enum(['ACTION', 'GUIDANCE', 'MILESTONE']),
  completionMode: z.enum([
    'ACKNOWLEDGEMENT',
    'STRUCTURED_OUTCOME',
    'CLIENT_REPORT_CONSULTANT_VERIFY',
    'CONSULTANT_VERIFY',
    'SYSTEM_VERIFY',
  ]),
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
  paths: z
    .array(
      z.object({
        key: z.string().min(1).max(80),
        clientLabel: z.string().min(1).max(160),
        internalLabel: z.string().max(500).nullable().optional(),
        status: z.enum(['AVAILABLE', 'ACTIVE', 'INACTIVE', 'RETIRED']),
        sortOrder: z.number().int(),
      }),
    )
    .max(20)
    .optional(),
  dependencies: z
    .array(
      z.object({
        dependentKey: z.string(),
        prerequisiteKey: z.string(),
        groupKey: z.string().optional(),
        mode: z.enum(['ALL', 'ANY']).optional(),
      }),
    )
    .max(500)
    .optional(),
});

export function createPlanRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  recorder?: AuthorizationDenialRecorder,
) {
  const router = Router();
  router.get(
    '/consultant/clients/:clientId/plans',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const before =
          req.query.before === undefined ? undefined : z.string().uuid().parse(req.query.before);
        res.json(await listClientPlans(prisma, req.params.clientId as string, before));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/clients/:clientId/plans/:planId/history',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const before =
          req.query.before === undefined
            ? undefined
            : z.coerce.number().int().positive().parse(req.query.before);
        res.json(
          await getPlanVersionHistory(
            prisma,
            req.params.clientId as string,
            req.params.planId as string,
            before,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/plan/response-preview',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const input = z
          .object({
            items: z
              .array(
                z.object({
                  stableKey: z.string().min(1).max(80),
                  completionMode: itemSchema.shape.completionMode,
                  outcomeSchema: z.record(z.string(), z.unknown()).optional(),
                }),
              )
              .max(200),
          })
          .parse(req.body);
        res.json({
          items: input.items.map((item) => ({
            stableKey: item.stableKey,
            ...clientResponseForm(item.outcomeSchema, item.completionMode),
          })),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/clients/:clientId/plan',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const planId =
          req.query.planId === undefined ? undefined : z.string().uuid().parse(req.query.planId);
        const mode = z.enum(['new']).optional().parse(req.query.mode);
        if (mode && planId)
          throw new AppError('INVALID_REQUEST', 400, 'Choose a saved Plan or a new draft.');
        res.json(
          await getPlanBuilder(prisma, req.params.clientId as string, planId, mode === 'new'),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/plans',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.publish', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        res
          .status(201)
          .json(
            await createPlanDraft(
              prisma,
              req.params.clientId as string,
              draftSchema.parse(req.body) as Parameters<typeof createPlanDraft>[2],
            ),
          );
      } catch (error) {
        next(error);
      }
    },
  );
  router.put(
    '/consultant/clients/:clientId/plans/:planId',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.publish', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({ expectedVersion: z.number().int().positive(), draft: draftSchema })
          .parse(req.body);
        const plan = await prisma.plan.findFirst({
          where: { id: req.params.planId as string, clientId: req.params.clientId as string },
          select: { id: true },
        });
        if (!plan) throw new AppError('NOT_FOUND', 404, 'Plan was not found');
        res.json(
          await revisePlanDraft(
            prisma,
            plan.id,
            parsed.expectedVersion,
            parsed.draft as Parameters<typeof revisePlanDraft>[3],
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/plans/:planId/approve',
    requireRole('CONSULTANT'),
    requireCapability(
      authorization,
      'review.publish',
      'clientId',
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        res.json(
          await approvePlan(
            prisma,
            req.params.clientId as string,
            req.params.planId as string,
            req.auth!.userId,
            z.object({ expectedVersion: z.number().int().positive() }).parse(req.body)
              .expectedVersion,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/client/plan/items/:itemId/history',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        res.json(
          await getPlanItemHistory(
            prisma,
            req.auth!.clientId!,
            z.string().uuid().parse(req.params.itemId),
            z.string().uuid().optional().parse(req.query.before),
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/clients/:clientId/plan/items/:itemId/history',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        res.json(
          await getPlanItemHistory(
            prisma,
            req.params.clientId as string,
            z.string().uuid().parse(req.params.itemId),
            z.string().uuid().optional().parse(req.query.before),
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/client/plan/items/:itemId/draft', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(
        await getResponseDraft(
          prisma,
          req.auth!.clientId!,
          z.string().uuid().parse(req.params.itemId),
          req.auth!.userId,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.put('/client/plan/items/:itemId/draft', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = z
        .object({
          expectedRevision: z.number().int().min(0),
          contextVersion: z.string().datetime(),
          values: z
            .record(z.string().max(100), z.string().max(10000))
            .refine((value) => Object.keys(value).length <= 100),
          note: z.string().max(2000),
          help: z.boolean(),
          documentIds: z.array(z.string().uuid()).max(5),
        })
        .strict()
        .parse(req.body);
      res.json(
        await saveResponseDraft(
          prisma,
          req.auth!.clientId!,
          z.string().uuid().parse(req.params.itemId),
          req.auth!.userId,
          input,
        ),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/plan', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await getClientPlan(prisma, req.auth!.clientId!));
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/clients/:clientId/plan/execution',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const planId =
          req.query.planId === undefined ? undefined : z.string().uuid().parse(req.query.planId);
        res.json(await getClientPlan(prisma, req.params.clientId as string, planId));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/clients/:clientId/plans/:planId/sources',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'review.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        res.json(
          await getPlanSourcePreview(
            prisma,
            req.params.clientId as string,
            req.params.planId as string,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/plan/items/:itemId/outcomes',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            idempotencyKey: z.string().min(8).max(160),
            action: z.enum(['COMPLETE', 'UNABLE']),
            documentIds: z.array(z.string().uuid()).max(5).optional(),
            draftRevision: z.number().int().min(0).optional(),
            draftContextVersion: z.string().datetime().optional(),
            outcome: z.record(z.string(), z.unknown()).optional(),
            reason: z.string().min(1).max(1000).optional(),
          })
          .parse(req.body);
        res.json(
          await executePlanItem(prisma, {
            clientId: req.auth!.clientId!,
            itemId: req.params.itemId as string,
            actorId: req.auth!.userId,
            ...parsed,
          } as Parameters<typeof executePlanItem>[1]),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/plan/items/:itemId/verify',
    requireRole('CONSULTANT'),
    requireCapability(
      authorization,
      'review.publish',
      'clientId',
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        res.json(
          await verifyPlanItem(
            prisma,
            req.params.clientId as string,
            req.params.itemId as string,
            req.auth!.userId,
            z
              .object({
                decision: z.enum(['VERIFY', 'RETURN', 'RESUME']),
                expectedOutcomeId: z.string().uuid().nullable(),
                note: z.string().trim().max(2000).optional(),
              })
              .parse(req.body),
          ),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/clients/:clientId/plans/:planId/reconcile',
    requireRole('CONSULTANT'),
    requireCapability(
      authorization,
      'review.publish',
      'clientId',
      { requireStepUp: true },
      recorder,
    ),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            expectedVersion: z.number().int().positive(),
            expectedSourceFingerprint: z.string().length(64),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict()
          .parse(req.body);
        res.json(
          await reconcilePlanSources(prisma, {
            clientId: req.params.clientId as string,
            planId: req.params.planId as string,
            actorId: req.auth!.userId,
            ...parsed,
          } as Parameters<typeof reconcilePlanSources>[1]),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
