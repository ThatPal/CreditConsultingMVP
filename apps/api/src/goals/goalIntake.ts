import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

export const goalInputSchema = z
  .object({
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
    targetAmount: z.number().int().min(5_000).max(250_000),
    allowAnnualFee: z.boolean().default(false),
  })
  .strict();

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const publicSelect = {
  goalType: true,
  scope: true,
  targetAmount: true,
  allowAnnualFee: true,
  version: true,
  expiresAt: true,
  consumedAt: true,
} satisfies Prisma.AnonymousGoalIntakeSelect;

function serialize<T extends { targetAmount: { toNumber(): number } }>(intake: T) {
  return { ...intake, targetAmount: intake.targetAmount.toNumber() };
}

async function activeIntake(prisma: PrismaClient, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  const intake = await prisma.anonymousGoalIntake.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, ...publicSelect },
  });
  if (!intake) throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  if (intake.expiresAt <= new Date() || intake.consumedAt)
    throw new AppError('INTAKE_UNAVAILABLE', 410, 'Goal intake is expired or already used');
  return intake;
}

export async function bindAnonymousGoalIntake(
  prisma: PrismaClient,
  token: string,
  clientId: string,
  actorId: string,
) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  return prisma.$transaction(async (tx) => {
    const intake = await tx.anonymousGoalIntake.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!intake) throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
    if (intake.consumedByClientId === clientId) {
      const goal = await tx.clientGoal.findFirst({
        where: { clientId, priority: 'PRIMARY', status: 'ACTIVE' },
      });
      if (!goal) throw new AppError('INTAKE_BINDING_INCOMPLETE', 409, 'Goal binding is incomplete');
      return { goal, replayed: true };
    }
    if (intake.consumedAt || intake.expiresAt <= new Date())
      throw new AppError('INTAKE_UNAVAILABLE', 410, 'Goal intake is expired or already used');
    const claimed = await tx.anonymousGoalIntake.updateMany({
      where: { id: intake.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date(), consumedByClientId: clientId },
    });
    if (claimed.count !== 1)
      throw new AppError('INTAKE_UNAVAILABLE', 410, 'Goal intake is expired or already used');

    const current = await tx.clientGoal.findFirst({
      where: { clientId, priority: 'PRIMARY', status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    });
    const goal = current
      ? await tx.clientGoal.update({
          where: { id: current.id },
          data: {
            goalType: intake.goalType,
            scope: intake.scope,
            targetAmount: intake.targetAmount,
            allowAnnualFee: intake.allowAnnualFee,
            version: { increment: 1 },
          },
        })
      : await tx.clientGoal.create({
          data: {
            clientId,
            goalType: intake.goalType,
            scope: intake.scope,
            targetAmount: intake.targetAmount,
            allowAnnualFee: intake.allowAnnualFee,
            priority: 'PRIMARY',
          },
        });
    await tx.clientGoalRevision.create({
      data: {
        goalId: goal.id,
        clientId,
        version: goal.version,
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: goal.targetAmount,
        allowAnnualFee: goal.allowAnnualFee,
        priority: goal.priority,
        status: goal.status,
        changedById: actorId,
        changeSource: 'GOAL_FIRST_INTAKE',
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId,
        clientId,
        action: current ? 'CLIENT_GOAL_RECONCILED_FROM_INTAKE' : 'CLIENT_GOAL_CREATED_FROM_INTAKE',
        entityType: 'ClientGoal',
        entityId: goal.id,
        metadata: { intakeId: intake.id, version: goal.version },
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: 'client.goal.changed',
        eventKey: `goal-intake-bound:${intake.id}`,
        aggregateType: 'ClientGoal',
        aggregateId: goal.id,
        payload: { clientId, domains: ['goals'], refetch: true, reassessmentRequired: true },
      },
    });
    return { goal, replayed: false };
  });
}

export function createGoalIntakePublicRouter(prisma: PrismaClient) {
  const router = Router();
  router.post('/', async (req, res, next) => {
    try {
      const input = goalInputSchema.parse(req.body);
      const token = randomBytes(32).toString('base64url');
      const intake = await prisma.anonymousGoalIntake.create({
        data: {
          ...input,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 72 * 3600_000),
        },
        select: publicSelect,
      });
      res.status(201).json({ token, intake: serialize(intake) });
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Goal details are invalid')
          : error,
      );
    }
  });
  router.get('/:token', async (req, res, next) => {
    try {
      const intake = await activeIntake(prisma, req.params.token as string);
      res.json({ intake: serialize(intake) });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/:token', async (req, res, next) => {
    try {
      const input = goalInputSchema
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
      const intake = await activeIntake(prisma, req.params.token as string);
      const changed = await prisma.anonymousGoalIntake.updateMany({
        where: {
          id: intake.id,
          version: input.version,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { ...input, version: { increment: 1 } },
      });
      if (!changed.count) throw new AppError('STALE_INTAKE', 409, 'Goal intake changed or expired');
      const updated = await prisma.anonymousGoalIntake.findUniqueOrThrow({
        where: { id: intake.id },
        select: publicSelect,
      });
      res.json({ intake: serialize(updated) });
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Goal details are invalid')
          : error,
      );
    }
  });
  return router;
}

export function createGoalIntakeBindingRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth, requireRole('CLIENT'));
  router.post('/:token/bind', async (req, res, next) => {
    try {
      const result = await bindAnonymousGoalIntake(
        prisma,
        req.params.token as string,
        req.auth!.clientId!,
        req.auth!.userId,
      );
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

export async function cleanupExpiredGoalIntakes(prisma: PrismaClient, now = new Date()) {
  return prisma.anonymousGoalIntake.deleteMany({
    where: { consumedAt: null, expiresAt: { lt: now } },
  });
}
