import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { AppError } from '../http/errors.js';
import type { GoalService } from './service.js';
const schema = z.object({
  goalType: z.enum([
    'ZERO_APR_CREDIT',
    'TOTAL_AVAILABLE_CREDIT',
    'BUSINESS_CREDIT',
    'PERSONAL_CREDIT',
    'BALANCE_TRANSFER_CAPACITY',
    'EXISTING_LIMIT_INCREASES',
    'REWARDS_POINTS_PORTFOLIO',
  ]),
  scope: z.enum(['PERSONAL', 'BUSINESS', 'BOTH']),
  targetAmount: z.number().positive().max(100_000_000).nullable().optional(),
  allowAnnualFee: z.boolean().optional(),
  priority: z.enum(['PRIMARY', 'SECONDARY']),
});
const updateSchema = schema
  .partial()
  .extend({ status: z.enum(['ACTIVE', 'ACHIEVED', 'PAUSED']).optional() })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
function parse<T>(validator: z.ZodType<T>, input: unknown): T {
  const result = validator.safeParse(input);
  if (!result.success)
    throw new AppError('VALIDATION_ERROR', 400, result.error.issues[0]?.message ?? 'Invalid goal');
  return result.data;
}
export function createGoalRouter(goals: GoalService) {
  const router = Router();
  router.use(requireAuth, requireRole('CLIENT'));
  router.get('/', async (req, res, next) => {
    try {
      res.json({ goals: await goals.list(req.auth!.clientId!) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/', async (req, res, next) => {
    try {
      res
        .status(201)
        .json({ goal: await goals.create(req.auth!.clientId!, parse(schema, req.body)) });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/:goalId', async (req, res, next) => {
    try {
      res.json({
        goal: await goals.update(
          req.auth!.clientId!,
          req.params.goalId as string,
          parse(updateSchema, req.body),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.delete('/:goalId', async (req, res, next) => {
    try {
      res.json({ goal: await goals.archive(req.auth!.clientId!, req.params.goalId as string) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/:goalId/archive', async (req, res, next) => {
    try {
      res.json({ goal: await goals.archive(req.auth!.clientId!, req.params.goalId as string) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
