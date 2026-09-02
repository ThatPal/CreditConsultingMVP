import { Router } from 'express';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import { requireClientAccess, requireRole } from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { classifyCycle, resolveCurrentFocus } from './projection.js';

const goalSelect = {
  id: true,
  goalType: true,
  scope: true,
  targetAmount: true,
  priority: true,
  status: true,
} as const;

async function projection(prisma: PrismaClient, clientId: string) {
  const [client, journey, goal, profileState, latestReview, planCount] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.creditJourney.findUnique({
      where: { clientId },
      include: {
        cycles: {
          include: { goalSnapshot: true },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          take: 25,
        },
        nurturePeriods: { orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], take: 25 },
        _count: { select: { cycles: true, nurturePeriods: true } },
      },
    }),
    prisma.clientGoal.findFirst({
      where: { clientId, status: 'ACTIVE' },
      select: goalSelect,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.creditProfileState.findUnique({ where: { clientId } }),
    prisma.creditReview.findFirst({
      where: { clientId },
      select: { id: true, status: true, completedAt: true, readinessExpiresAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.plan.count({ where: { clientId, status: { in: ['APPROVED', 'ACTIVE', 'STALE'] } } }),
  ]);
  if (!client) throw new AppError('NOT_FOUND', 404, 'Client was not found');
  const activeCycle = journey?.cycles.find((cycle) => cycle.status === 'ACTIVE') ?? null;
  const activeNurture =
    journey?.nurturePeriods.find((period) => period.status === 'ACTIVE') ?? null;
  const focus = resolveCurrentFocus({ activeCycle, activeNurture, hasGoal: Boolean(goal) });
  return {
    client,
    goal: goal ? { ...goal, targetAmount: goal.targetAmount?.toNumber() ?? null } : null,
    journey: journey
      ? {
          id: journey.id,
          status: journey.status,
          startedAt: journey.startedAt,
          currentFocus: focus,
          cycles: journey.cycles.map((cycle) => ({
            id: cycle.id,
            cycleNumber: cycle.cycleNumber,
            displayName: cycle.displayName,
            status: cycle.status,
            currentStage: cycle.currentStage,
            startedAt: cycle.startedAt,
            closedAt: cycle.closedAt,
            finalResult: cycle.finalResult,
            timelineGroup: classifyCycle(cycle.status),
            goalSnapshot: cycle.goalSnapshot
              ? {
                  goalType: cycle.goalSnapshot.goalType,
                  scope: cycle.goalSnapshot.scope,
                  targetAmount: cycle.goalSnapshot.targetAmount?.toNumber() ?? null,
                  sourceGoalVersion: cycle.goalSnapshot.sourceGoalVersion,
                  capturedAt: cycle.goalSnapshot.capturedAt,
                }
              : null,
          })),
          nurturePeriods: journey.nurturePeriods.map((period) => ({
            id: period.id,
            status: period.status,
            reasonCode: period.reasonCode,
            startedAt: period.startedAt,
            expectedEnd: period.expectedEnd,
            endedAt: period.endedAt,
          })),
          historyWindow: {
            limit: 25,
            cycleTotal: journey._count.cycles,
            nurturePeriodTotal: journey._count.nurturePeriods,
          },
        }
      : {
          id: null,
          status: 'NOT_STARTED',
          startedAt: null,
          currentFocus: focus,
          cycles: [],
          nurturePeriods: [],
          historyWindow: { limit: 25, cycleTotal: 0, nurturePeriodTotal: 0 },
        },
    foundations: {
      creditProfile: profileState ?? {
        status: latestReview ? 'REVIEW_IN_PROGRESS' : 'NOT_AVAILABLE',
        effectiveAt: latestReview?.completedAt ?? null,
        staleAt: latestReview?.readinessExpiresAt ?? null,
      },
      plan: { status: planCount > 0 ? 'AVAILABLE' : 'NOT_AVAILABLE', openActionCount: planCount },
      appointment: { status: 'NOT_AVAILABLE' },
    },
    alerts: [],
  };
}

export function createJourneyRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  denialRecorder?: AuthorizationDenialRecorder,
) {
  const router = Router();
  router.get('/client/home', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await projection(prisma, req.auth!.clientId!));
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/journey', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await projection(prisma, req.auth!.clientId!));
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/clients/:clientId/journey',
    requireRole('CONSULTANT'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        res.json(await projection(prisma, req.params.clientId as string));
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
