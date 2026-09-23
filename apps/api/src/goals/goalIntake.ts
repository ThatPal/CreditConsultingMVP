import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { IdempotencyConflictError } from '../transactions/consequentialCommand.js';
function entryError(error: unknown) {
  if (error instanceof AppError || error instanceof z.ZodError) return error;
  if (error instanceof IdempotencyConflictError)
    return new AppError(
      error.code,
      409,
      'The decision key is already in use. Retry the original decision.',
    );
  return new AppError(
    'ENTRY_COMMAND_FAILED',
    500,
    'The saved goal operation could not be completed. Retry safely.',
  );
}

import { entryGoalValuesSchema, intakeLocatorSchema, intakeResolveSchema } from '@credit/shared';
import { lockGoalCollection } from './prismaGoalStore.js';
import { pendingIntakes, previewIntake, resolveIntake } from './entryIntake.js';

export const goalInputSchema = entryGoalValuesSchema
  .extend({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().max(32).nullable().optional(),
  })
  .strict();

export const hashGoalIntakeToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const publicSelect = {
  goalType: true,
  scope: true,
  targetAmount: true,
  allowAnnualFee: true,
  cardTypePreference: true,
  offerPreferences: true,
  feePreference: true,
  preferenceNote: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  version: true,
  expiresAt: true,
  consumedAt: true,
} satisfies Prisma.AnonymousGoalIntakeSelect;

function serialize<T extends { targetAmount: { toNumber(): number } }>(intake: T) {
  return { ...intake, targetAmount: intake.targetAmount.toNumber() };
}

async function activeIntake(prisma: PrismaClient | Prisma.TransactionClient, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  const intake = await prisma.anonymousGoalIntake.findUnique({
    where: { tokenHash: hashGoalIntakeToken(token) },
    select: { id: true, ...publicSelect },
  });
  if (!intake) throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  if (intake.expiresAt <= new Date() || intake.consumedAt)
    throw new AppError('INTAKE_UNAVAILABLE', 410, 'Goal intake is expired or already used');
  return intake;
}

// Legacy callers must supply an explicit decision through the binding route.
export async function bindAnonymousGoalIntake(..._args: unknown[]): Promise<never> {
  void _args;
  throw new AppError(
    'INTAKE_DECISION_REQUIRED',
    400,
    'Review and explicitly confirm the saved goal first',
  );
}
export async function bindClaimedGoalIntake(..._args: unknown[]) {
  void _args;
  return null;
}

export async function prepareGoalIntakeRegistrationClaim(
  prisma: PrismaClient,
  token: string | undefined,
  email: string,
  intakeVersion?: number,
  attemptKey?: string,
) {
  if (!token) return null;
  if (!intakeVersion || !attemptKey || !/^[A-Za-z0-9_-]{16,128}$/.test(attemptKey))
    throw new AppError(
      'INTAKE_DECISION_REQUIRED',
      400,
      'A saved intake version and registration attempt are required',
    );
  const normalizedEmail = email.trim().toLowerCase();
  const registrationEmailHash = hashGoalIntakeToken(normalizedEmail);
  const registrationAttemptKeyHash = hashGoalIntakeToken(
    JSON.stringify([normalizedEmail, attemptKey]),
  );
  const intakeTokenHash = hashGoalIntakeToken(token);
  const requestHash = hashGoalIntakeToken(
    JSON.stringify({ registrationEmailHash, intakeTokenHash, intakeVersion }),
  );
  const previous = await prisma.goalIntakeRegistrationClaim.findUnique({
    where: { registrationAttemptKeyHash },
  });
  if (previous && previous.requestHash !== requestHash)
    throw new AppError(
      'IDEMPOTENCY_KEY_REUSED',
      409,
      'Registration attempt changed; start a new explicit attempt',
    );
  const intake = await activeIntake(prisma, token);
  if (intake.email !== normalizedEmail)
    throw new AppError('INTAKE_UNAVAILABLE', 404, 'Goal intake is unavailable');
  if (intake.version !== intakeVersion)
    throw new AppError('STALE_INTAKE', 409, 'Review the updated saved goal before registering');
  if (previous) return previous.id;
  const claim = await prisma.goalIntakeRegistrationClaim.upsert({
    where: { registrationAttemptKeyHash },
    update: {},
    create: {
      registrationEmailHash,
      registrationAttemptKeyHash,
      requestHash,
      intakeTokenHash,
      intakeVersion,
      expiresAt: intake.expiresAt,
    },
  });
  if (claim.requestHash !== requestHash)
    throw new AppError('IDEMPOTENCY_KEY_REUSED', 409, 'Registration attempt changed');
  return claim.id;
}
export async function attachGoalIntakeClaim(
  prisma: PrismaClient,
  claimId: string,
  clientId: string,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockGoalCollection(tx, clientId);
    const client = await tx.client.findFirst({ where: { id: clientId, userId: actorId } });
    if (!client)
      throw new AppError('INTAKE_UNAVAILABLE', 404, 'Account association is unavailable');
    const claim = await tx.goalIntakeRegistrationClaim.findUniqueOrThrow({
      where: { id: claimId },
    });
    await tx.$queryRaw`SELECT id FROM "AnonymousGoalIntake" WHERE "tokenHash" = ${claim.intakeTokenHash} FOR UPDATE`;
    const retained = await tx.anonymousGoalIntake.findUnique({
      where: { tokenHash: claim.intakeTokenHash },
    });
    if (!retained || retained.consumedAt || retained.expiresAt <= new Date())
      throw new AppError('INTAKE_UNAVAILABLE', 404, 'Saved goal association requires recovery');
    const foreign = await tx.goalIntakeRegistrationClaim.findFirst({
      where: { intakeTokenHash: claim.intakeTokenHash, attachedClientId: { not: clientId } },
    });
    if (foreign)
      throw new AppError('INTAKE_UNAVAILABLE', 404, 'Account association is unavailable');
    const updated = await tx.goalIntakeRegistrationClaim.updateMany({
      where: {
        id: claimId,
        attachedUserId: null,
        attachedClientId: null,
        registrationAttemptKeyHash: { not: null },
        intakeVersion: { not: null },
      },
      data: { attachedUserId: actorId, attachedClientId: clientId, attachedAt: new Date() },
    });
    if (!updated.count && (claim.attachedUserId !== actorId || claim.attachedClientId !== clientId))
      throw new AppError('INTAKE_UNAVAILABLE', 404, 'Account association is unavailable');
  });
}

export function createGoalIntakePublicRouter(prisma: PrismaClient) {
  const router = Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  router.post('/', async (req, res, next) => {
    try {
      const input = goalInputSchema.parse(req.body);
      const token = randomBytes(32).toString('base64url');
      const intake = await prisma.anonymousGoalIntake.create({
        data: {
          ...input,
          preferenceNote: input.preferenceNote ?? null,
          phone: input.phone ?? null,
          tokenHash: hashGoalIntakeToken(token),
          expiresAt: new Date(Date.now() + 72 * 3600_000),
        },
        select: publicSelect,
      });
      res.status(201).json({ token, intake: serialize(intake) });
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Goal details are invalid')
          : entryError(error),
      );
    }
  });
  router.get('/:token', async (req, res, next) => {
    try {
      const intake = await activeIntake(prisma, req.params.token as string);
      res.json({ intake: serialize(intake) });
    } catch (error) {
      next(entryError(error));
    }
  });
  router.patch('/:token', async (req, res, next) => {
    try {
      const input = goalInputSchema
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
      const updated = await prisma.$transaction(async (tx) => {
        const intake = await activeIntake(tx, req.params.token as string);
        const changed = await tx.anonymousGoalIntake.updateMany({
          where: {
            id: intake.id,
            version: input.version,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            ...input,
            preferenceNote: input.preferenceNote ?? null,
            phone: input.phone ?? null,
            version: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new AppError('STALE_INTAKE', 409, 'Goal intake changed or expired');
        return tx.anonymousGoalIntake.findUniqueOrThrow({
          where: { id: intake.id },
          select: publicSelect,
        });
      });
      res.json({ intake: serialize(updated) });
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Goal details are invalid')
          : entryError(error),
      );
    }
  });
  return router;
}

export function createGoalIntakeBindingRouter(prisma: PrismaClient) {
  const router = Router();
  router.use(requireAuth, requireRole('CLIENT'));
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });
  router.get('/pending', async (req, res, next) => {
    try {
      res.json(
        await pendingIntakes(prisma, { clientId: req.auth!.clientId!, actorId: req.auth!.userId }),
      );
    } catch (error) {
      next(entryError(error));
    }
  });
  router.post('/preview', async (req, res, next) => {
    try {
      const { locator } = z.object({ locator: intakeLocatorSchema }).strict().parse(req.body);
      res.json(
        await previewIntake(prisma, locator, {
          clientId: req.auth!.clientId!,
          actorId: req.auth!.userId,
        }),
      );
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Saved goal selection is invalid')
          : entryError(error),
      );
    }
  });
  router.post(['/resolve', '/:token/bind'], async (req, res, next) => {
    try {
      if (!req.body?.decision)
        throw new AppError(
          'INTAKE_DECISION_REQUIRED',
          400,
          'Review and explicitly confirm the saved goal first',
        );
      const input = intakeResolveSchema.parse(
        req.params.token
          ? { ...req.body, locator: { kind: 'TOKEN', value: req.params.token } }
          : req.body,
      );
      const result = await resolveIntake(
        prisma,
        input,
        { clientId: req.auth!.clientId!, actorId: req.auth!.userId },
        req.get('Idempotency-Key') ?? '',
      );
      res.json(result);
    } catch (error) {
      next(
        error instanceof z.ZodError
          ? new AppError('VALIDATION_ERROR', 400, 'Saved goal decision is invalid')
          : entryError(error),
      );
    }
  });
  return router;
}
export async function cleanupExpiredGoalIntakes(prisma: PrismaClient, now = new Date()) {
  const candidates = await prisma.anonymousGoalIntake.findMany({
    where: { consumedAt: null, expiresAt: { lt: now } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  let count = 0;
  for (const candidate of candidates)
    count += await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AnonymousGoalIntake" WHERE id = ${candidate.id}::uuid FOR UPDATE`;
      const intake = await tx.anonymousGoalIntake.findUnique({
        where: { id: candidate.id },
        include: { resolution: true },
      });
      if (!intake || intake.consumedAt || intake.resolution || intake.expiresAt >= now) return 0;
      const attached = await tx.goalIntakeRegistrationClaim.count({
        where: { intakeTokenHash: intake.tokenHash, attachedClientId: { not: null } },
      });
      if (attached) return 0;
      await tx.anonymousGoalIntake.delete({ where: { id: intake.id } });
      return 1;
    });
  return { count };
}
