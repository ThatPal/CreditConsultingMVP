import { createHash } from 'node:crypto';
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
  .extend({
    version: z.number().int().positive(),
    status: z.enum(['ACTIVE', 'ACHIEVED', 'PAUSED']).optional(),
  })
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
      const input = parse(schema, req.body);
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      res.status(201).json({
        goal: await goals.create(req.auth!.clientId!, input, {
          actorId: req.auth!.userId,
          idempotencyKey,
          requestHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/:goalId', async (req, res, next) => {
    try {
      const input = parse(updateSchema, req.body);
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      res.json({
        goal: await goals.update(req.auth!.clientId!, req.params.goalId as string, input, {
          actorId: req.auth!.userId,
          idempotencyKey,
          requestHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  // Kept as an explicit method rejection so older clients cannot bypass the
  // governed, idempotent archive command below.
  router.delete('/:goalId', (_req, res) => {
    res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST /archive' } });
  });
  router.post('/:goalId/archive', async (req, res, next) => {
    try {
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey)
        throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
      res.json({
        goal: await goals.archive(req.auth!.clientId!, req.params.goalId as string, {
          actorId: req.auth!.userId,
          idempotencyKey,
          requestHash: createHash('sha256')
            .update(req.params.goalId as string)
            .digest('hex'),
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
