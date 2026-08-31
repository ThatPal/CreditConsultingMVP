import { Router } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/authService.js';
import {
  requireAuth,
  requireCapability,
  requireClientAccess,
  requireRole,
} from '../auth/middleware.js';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import {
  createPrismaAuthorizationDenialRecorder,
  createPrismaAuthorizationService,
  type AuthorizationService,
} from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';

const intakeSchema = z.object({
  scope: z.enum(['PERSONAL', 'BUSINESS', 'BOTH']),
  targetAmount: z.number().positive().max(100_000_000),
  intendedAt: z.coerce.date().optional(),
});
const decisionSchema = z.object({
  outcome: z.enum(['APPLY_NOW', 'PREPARE_FIRST', 'WAIT']),
  riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH']),
  timingBandDays: z.number().int().min(0).max(730).optional(),
  factorCodes: z.array(z.string().trim().min(1).max(80)).max(30),
  actionOptionIds: z.array(z.string().uuid()).max(20).default([]),
  overrideReason: z.string().trim().min(10).max(1000).optional(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('VALIDATION_ERROR', 400, result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

const assessmentInclude = { factors: { include: { option: true } } } as const;
function present<T extends { targetAmount: { toNumber(): number } }>(assessment: T) {
  return { ...assessment, targetAmount: assessment.targetAmount.toNumber() };
}

export function createReadinessRouter(
  prisma: PrismaClient,
  auth: AuthService,
  authorization: AuthorizationService = createPrismaAuthorizationService(prisma),
  denialRecorder: AuthorizationDenialRecorder = createPrismaAuthorizationDenialRecorder(prisma),
) {
  const router = Router();
  router.use(requireAuth);

  router.get('/options', async (_req, res, next) => {
    try {
      const options = await prisma.optionTemplate.findMany({
        where: { active: true, kind: { in: ['RATIONALE', 'ACTION_BUNDLE', 'CHECKLIST'] } },
        orderBy: [{ kind: 'asc' }, { label: 'asc' }],
      });
      res.json({ options });
    } catch (error) {
      next(error);
    }
  });

  router.get('/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const assessment = await prisma.readinessAssessment.findFirst({
        where: { clientId: req.auth!.clientId! },
        orderBy: { version: 'desc' },
        include: assessmentInclude,
      });
      res.json({ assessment: assessment ? present(assessment) : null });
    } catch (error) {
      next(error);
    }
  });

  router.post('/client', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = parse(intakeSchema, req.body);
      const clientId = req.auth!.clientId!;
      const assessment = await prisma.$transaction(async (tx) => {
        const latest = await tx.readinessAssessment.findFirst({
          where: { clientId },
          orderBy: { version: 'desc' },
        });
        const snapshot = await tx.creditSnapshot.findFirst({
          where: { clientId },
          orderBy: { capturedAt: 'desc' },
        });
        const created = await tx.readinessAssessment.create({
          data: {
            clientId,
            version: (latest?.version ?? 0) + 1,
            scope: input.scope,
            targetAmount: input.targetAmount,
            intendedAt: input.intendedAt ?? null,
            profileAsOf: snapshot?.capturedAt ?? null,
          },
          include: assessmentInclude,
        });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action: 'READINESS_INTAKE_CREATED',
            entityType: 'ReadinessAssessment',
            entityId: created.id,
          },
        });
        return created;
      });
      res.status(201).json({ assessment: present(assessment) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/consultant', requireRole('CONSULTANT', 'ADMIN'), async (req, res, next) => {
    try {
      const assessments = await prisma.readinessAssessment.findMany({
        where:
          req.auth!.role === 'ADMIN'
            ? { status: { in: ['DRAFT', 'IN_REVIEW'] } }
            : {
                status: { in: ['DRAFT', 'IN_REVIEW'] },
                client: { assignedConsultantId: req.auth!.userId },
              },
        include: { client: { select: { firstName: true, lastName: true } }, factors: true },
        orderBy: [{ updatedAt: 'asc' }],
        take: 100,
      });
      res.json({ assessments: assessments.map(present) });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/consultant/:clientId',
    requireRole('CONSULTANT', 'ADMIN'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        const assessment = await prisma.readinessAssessment.findFirst({
          where: { clientId: req.params.clientId as string },
          orderBy: { version: 'desc' },
          include: assessmentInclude,
        });
        res.json({ assessment: assessment ? present(assessment) : null });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/consultant/:clientId/:assessmentId/confirm',
    requireRole('CONSULTANT', 'ADMIN'),
    requireCapability(
      authorization,
      'review.publish',
      'clientId',
      { requireStepUp: true },
      denialRecorder,
    ),
    async (req, res, next) => {
      try {
        const input = parse(decisionSchema, req.body);
        const clientId = req.params.clientId as string;
        const assessmentId = req.params.assessmentId as string;
        const result = await prisma.$transaction(async (tx) => {
          const existing = await tx.readinessAssessment.findFirst({
            where: { id: assessmentId, clientId },
          });
          if (!existing) throw new AppError('NOT_FOUND', 404, 'Readiness assessment was not found');
          const snapshot = await tx.creditSnapshot.findFirst({
            where: { clientId },
            orderBy: { capturedAt: 'desc' },
          });
          if (!snapshot || snapshot.expiresAt <= new Date())
            throw new AppError(
              'PROFILE_STALE',
              409,
              'A current Credit Profile is required before confirmation',
            );
          if (existing.status === 'CONFIRMED')
            throw new AppError('ALREADY_CONFIRMED', 409, 'This assessment is already confirmed');
          await tx.readinessFactor.deleteMany({ where: { assessmentId } });
          if (input.factorCodes.length)
            await tx.readinessFactor.createMany({
              data: input.factorCodes.map((code) => ({ assessmentId, code })),
            });
          const assessment = await tx.readinessAssessment.update({
            where: { id: assessmentId },
            data: {
              consultantId: req.auth!.userId,
              status: 'CONFIRMED',
              outcome: input.outcome,
              riskLevel: input.riskLevel,
              timingBandDays: input.timingBandDays ?? null,
              overrideReason: input.overrideReason ?? null,
              confirmedAt: new Date(),
              profileAsOf: snapshot.capturedAt,
            },
            include: assessmentInclude,
          });
          const selectedBundles = input.actionOptionIds.length
            ? await tx.optionTemplate.findMany({
                where: { id: { in: input.actionOptionIds }, active: true, kind: 'ACTION_BUNDLE' },
              })
            : [];
          const fallback =
            input.outcome === 'APPLY_NOW'
              ? ['Schedule major application strategy session']
              : input.outcome === 'WAIT'
                ? ['Pause major applications until reassessment']
                : ['Complete major application preparation'];
          const actionTitles = selectedBundles.length
            ? selectedBundles.map((item) => item.label)
            : fallback;
          for (const [sortOrder, title] of actionTitles.entries())
            await tx.planAction.upsert({
              where: {
                sourceType_sourceId_title: {
                  sourceType: 'READINESS',
                  sourceId: assessmentId,
                  title,
                },
              },
              create: {
                clientId,
                title,
                owner: 'CLIENT',
                sourceType: 'READINESS',
                sourceId: assessmentId,
                sortOrder,
              },
              update: { status: 'READY', sortOrder },
            });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'READINESS_CONFIRMED',
              entityType: 'ReadinessAssessment',
              entityId: assessmentId,
              metadata: {
                outcome: input.outcome,
                riskLevel: input.riskLevel,
                factorCodes: input.factorCodes,
                actionOptionIds: input.actionOptionIds,
                overrideReason: input.overrideReason,
              },
            },
          });
          return assessment;
        });
        res.json({ assessment: present(result) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
