import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AuthService } from '../auth/authService.js';
import {
  requireAuth,
  requireCapability,
  requireClientAccess,
  requireRole,
} from '../auth/middleware.js';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import type { PrismaClient, WorkItemStatus } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate, subscribeToLiveUpdates, type LiveUpdate } from '../liveUpdates.js';
import {
  createPrismaAuthorizationService,
  createPrismaAuthorizationDenialRecorder,
  createRealtimeAuthorizationBridge,
  type AuthorizationService,
} from '../authorization/authorizationService.js';
import {
  executeConsequentialCommand,
  IdempotencyConflictError,
} from '../transactions/consequentialCommand.js';
import {
  assertSupportTransition,
  authorizedSupportClientIds,
  resolveSupportAttachments,
  resolveSupportContext,
  routeSupportCase,
  supportContextLink,
  supportAttachmentProjection,
  supportReplyTransition,
} from '../support/supportDomain.js';
import {
  attentionClaimDecision,
  recordAttentionClaimConflict,
  reconcileSupportAttention,
  workQueueOrderBy,
} from '../attention/attentionService.js';

const supportCaseSchema = z.object({
  category: z.enum([
    'ACCOUNT',
    'BILLING',
    'CREDIT_REVIEW',
    'DOCUMENTS',
    'APPLICATION_ROUND',
    'MAJOR_READINESS',
    'TECHNICAL',
    'OTHER',
  ]),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(5000),
  contextType: z.enum(['GENERAL', 'DOCUMENT', 'REVIEW', 'PLAN', 'CARD', 'APPLICATION_ROUND', 'STRATEGY', 'APPOINTMENT', 'APPLICATION_SESSION', 'POST_ROUND', 'MAJOR_READINESS']).default('GENERAL'),
  contextResourceId: z.uuid().nullish(),
  attachmentDocumentIds: z.array(z.uuid()).max(5).default([]),
});
const supportReplySchema = z.object({
  message: z.string().trim().min(1).max(5000),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});
const consultantSupportReplySchema = supportReplySchema.extend({
  internal: z.boolean().default(false),
  macroCode: z.string().trim().max(80).nullish(),
});
const supportListQuery = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(['OPEN', 'WAITING_ON_SUPPORT', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED'])
    .optional(),
  category: supportCaseSchema.shape.category.optional(),
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const applicationCycleSteps = [
  [
    'STARTED',
    'Credit goal confirmation',
    'Confirm that your primary credit goal and target still reflect what you want to accomplish.',
  ],
  [
    'REVIEW_PURCHASE',
    'Purchase Credit Profile Review',
    'Choose and purchase the foundational Review.',
  ],
  [
    'CREDIT_REVIEW',
    'Complete Credit Profile Review',
    'Provide the report and information your consultant needs.',
  ],
  [
    'CONSULTANT_DECISION',
    'Consultant readiness decision',
    'Receive Ready, Action Required, or Not Ready.',
  ],
  [
    'POST_REVIEW_ACTIONS',
    'Complete post-Review actions',
    'Finish any optional preparation selected by your consultant.',
  ],
  [
    'ROUND_PURCHASE',
    'Purchase application service',
    'Purchase the optimized Credit Applications service.',
  ],
  [
    'STRATEGY',
    'Consultant strategy',
    'Your consultant researches and prepares the application strategy.',
  ],
  [
    'APPLICATION_SEQUENCE',
    'Application sequence',
    'The consultant confirms the planned order and alternatives.',
  ],
  [
    'APPLICATION_ROUND',
    'Application session',
    'Work through released applications with your consultant.',
  ],
  [
    'RESULTS',
    'Application results',
    'Record approvals, declines, pending outcomes, and approved limits.',
  ],
  [
    'POST_APPLICATION_ACTIONS',
    'Post-application actions',
    'Complete follow-ups, reconsideration, and card-management actions.',
  ],
  ['FINAL_RESULTS', 'Cycle final results', 'Review the completed outcome and close the cycle.'],
] as const;
const applicationCycleInclude = {
  steps: { orderBy: { sortOrder: 'asc' as const } },
  applications: { orderBy: { submittedAt: 'asc' as const } },
} as const;

const supportCaseInclude = {
  messages: {
    where: { internal: false },
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, role: true } } },
  },
  categoryDefinition: { select: { key: true, name: true } },
  attachments: { select: supportAttachmentProjection },
} as const;
const staffSupportCaseInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, role: true } } },
  },
  categoryDefinition: { select: { key: true, name: true } },
  attachments: { select: supportAttachmentProjection },
  assignmentEvents: { orderBy: { createdAt: 'asc' as const } },
  aiArtifacts: { orderBy: { createdAt: 'desc' as const } },
} as const;
const activeSupportStatuses = ['OPEN', 'WAITING_ON_SUPPORT', 'WAITING_ON_CLIENT'] as const;
const historicalSupportStatuses = ['RESOLVED', 'CLOSED'] as const;

function requestHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function supportIdempotencyKey(req: import('express').Request, fallback: string) {
  const header = req.get('idempotency-key')?.trim();
  return header && header.length <= 160 ? header : fallback;
}

function mapSupportDomainError(error: unknown): never {
  if (error instanceof IdempotencyConflictError)
    throw new AppError(error.code, 409, 'This support command conflicts with an earlier request');
  const code = error instanceof Error ? error.message : '';
  if (['SUPPORT_CONTEXT_NOT_FOUND', 'SUPPORT_ATTACHMENT_NOT_FOUND'].includes(code))
    throw new AppError('NOT_FOUND', 404, 'Support context or attachment was not found');
  if (code.startsWith('SUPPORT_') || code === 'TOO_MANY_SUPPORT_ATTACHMENTS')
    throw new AppError('VALIDATION_ERROR', 400, 'Check the support context and attachments');
  throw error;
}

async function supportContextProjection(
  prisma: PrismaClient,
  item: {
    clientId: string;
    category: import('../generated/prisma/client.js').SupportCategory;
    contextType: import('../generated/prisma/client.js').SupportContextType;
    contextResourceId: string | null;
  },
) {
  try {
    const context = await resolveSupportContext(prisma, {
      clientId: item.clientId,
      category: item.category,
      contextType: item.contextType,
      contextResourceId: item.contextResourceId,
    });
    return { ...context, link: supportContextLink(context.type, context.resourceId) };
  } catch {
    return {
      type: item.contextType,
      resourceId: item.contextResourceId,
      summary: 'Context unavailable',
    };
  }
}

async function getSupportNotificationRecipients(
  prisma: PrismaClient,
  consultantId?: string | null,
) {
  const administrators = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  return [
    ...new Set([consultantId, ...administrators.map(({ id }) => id)].filter(Boolean)),
  ] as string[];
}

export function createOperationsRouter(
  prisma: PrismaClient,
  auth: AuthService,
  options: { heartbeatIntervalMs?: number } = {},
  authorization: AuthorizationService = createPrismaAuthorizationService(prisma),
  denialRecorder: AuthorizationDenialRecorder = createPrismaAuthorizationDenialRecorder(prisma),
) {
  const router = Router();
  const realtimeAuthorization = createRealtimeAuthorizationBridge(authorization);
  const resolveSupportClient: import('express').RequestHandler = async (req, _res, next) => {
    try {
      const supportCase = await prisma.supportCase.findUnique({
        where: { id: req.params.caseId as string },
        select: { clientId: true },
      });
      if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
      req.params.clientId = supportCase.clientId;
      next();
    } catch (error) {
      next(error);
    }
  };
  router.use(requireAuth);
  router.get('/live-updates', async (req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

    let active = true;
    const send = async (update: LiveUpdate) => {
      if (!active || res.writableEnded) return;
      const allowed = await realtimeAuthorization.canSubscribeToClient(req.auth!, update.clientId);
      if (allowed) res.write(`event: refresh\ndata: ${JSON.stringify(update)}\n\n`);
    };
    const unsubscribe = subscribeToLiveUpdates((update) => void send(update));
    const heartbeat = setInterval(() => {
      if (!res.writableEnded) res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, options.heartbeatIntervalMs ?? 5000);
    req.on('close', () => {
      active = false;
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
  router.get('/notifications', async (req, res, next) => {
    try {
      const [notifications, unread] = await Promise.all([
        prisma.notification.findMany({
          where: { userId: req.auth!.userId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.notification.count({ where: { userId: req.auth!.userId, readAt: null } }),
      ]);
      res.json({ notifications, unread });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/notifications/:notificationId/read', async (req, res, next) => {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id: req.params.notificationId as string, userId: req.auth!.userId },
      });
      if (!notification) throw new AppError('NOT_FOUND', 404, 'Notification was not found');
      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: notification.readAt ?? new Date() },
      });
      res.json({ notification: updated });
    } catch (error) {
      next(error);
    }
  });
  router.post('/notifications/read-all', async (req, res, next) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.auth!.userId, readAt: null },
        data: { readAt: new Date() },
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  router.delete('/notifications', async (req, res, next) => {
    try {
      await prisma.notification.deleteMany({ where: { userId: req.auth!.userId } });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/cards', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const [cards, sourceReview] = await Promise.all([
        prisma.clientCard.findMany({
          where: { clientId },
          orderBy: [{ accountStatus: 'asc' }, { issuer: 'asc' }, { cardName: 'asc' }],
        }),
        prisma.creditReview.findFirst({
          where: { clientId, status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            completedAt: true,
            submittedAt: true,
            createdAt: true,
            intake: { select: { reportDate: true } },
          },
        }),
      ]);
      res.json({
        cards: cards.map((card) => ({
          ...card,
          creditLimit: card.creditLimit?.toNumber() ?? null,
          balance: card.balance?.toNumber() ?? null,
        })),
        reviewSource: sourceReview
          ? {
              reviewId: sourceReview.id,
              reviewDate:
                sourceReview.intake?.reportDate ??
                sourceReview.completedAt ??
                sourceReview.submittedAt ??
                sourceReview.createdAt,
              status: sourceReview.status,
              verified: sourceReview.status === 'COMPLETE',
            }
          : null,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/application-cycles', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const cycles = await prisma.applicationCycle.findMany({
        where: { clientId: req.auth!.clientId! },
        include: applicationCycleInclude,
        orderBy: { startedAt: 'desc' },
      });
      res.json({
        cycles: cycles.map((cycle) => ({
          ...cycle,
          applications: cycle.applications.map((application) => ({
            ...application,
            approvedLimit: application.approvedLimit?.toNumber() ?? null,
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/application-cycles', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const cycle = await prisma.$transaction(async (tx) => {
        const active = await tx.applicationCycle.findFirst({
          where: { clientId, status: 'ACTIVE' },
        });
        if (active)
          throw new AppError(
            'APPLICATION_CYCLE_ACTIVE',
            409,
            'Complete the active application cycle before starting another',
          );
        const latest = await tx.applicationCycle.findFirst({
          where: { clientId },
          orderBy: { cycleNumber: 'desc' },
          select: { cycleNumber: true },
        });
        const journey = await tx.creditJourney.upsert({
          where: { clientId },
          create: { clientId },
          update: {},
        });
        const goal = await tx.clientGoal.findFirst({
          where: { clientId, status: 'ACTIVE' },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        });
        if (!goal)
          throw new AppError(
            'PRIMARY_GOAL_REQUIRED',
            409,
            'Confirm a goal before starting an application cycle',
          );
        const created = await tx.applicationCycle.create({
          data: {
            clientId,
            journeyId: journey.id,
            cycleNumber: (latest?.cycleNumber ?? 0) + 1,
            currentStage: 'STARTED',
            goalSnapshot: {
              create: {
                sourceGoalId: goal.id,
                sourceGoalVersion: goal.version,
                goalType: goal.goalType,
                scope: goal.scope,
                targetAmount: goal.targetAmount,
                allowAnnualFee: goal.allowAnnualFee,
                cardTypePreference: goal.cardTypePreference,
                offerPreferences: goal.offerPreferences,
                feePreference: goal.feePreference,
                preferenceNote: goal.preferenceNote,
              },
            },
            steps: {
              create: applicationCycleSteps.map(([stage, title, description], sortOrder) => ({
                stage,
                title,
                description,
                sortOrder,
                status: sortOrder === 0 ? 'AVAILABLE' : 'NOT_STARTED',
                ...(sortOrder === 0 ? { startedAt: new Date() } : {}),
              })),
            },
          },
          include: applicationCycleInclude,
        });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action: 'APPLICATION_CYCLE_STARTED',
            entityType: 'ApplicationCycle',
            entityId: created.id,
            metadata: { cycleNumber: created.cycleNumber },
          },
        });
        return created;
      });
      publishLiveUpdate(clientId, 'application-cycles');
      res.status(201).json({ cycle });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/client/application-cycles/:cycleId/confirm-goal',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const clientId = req.auth!.clientId!;
        const cycleId = Array.isArray(req.params.cycleId)
          ? req.params.cycleId[0]
          : req.params.cycleId;
        if (!cycleId)
          throw new AppError(
            'APPLICATION_CYCLE_NOT_FOUND',
            404,
            'Active application cycle not found',
          );
        const cycle = await prisma.applicationCycle.findFirst({
          where: { id: cycleId, clientId, status: 'ACTIVE' },
          include: { steps: { orderBy: { sortOrder: 'asc' } } },
        });
        if (!cycle)
          throw new AppError(
            'APPLICATION_CYCLE_NOT_FOUND',
            404,
            'Active application cycle not found',
          );
        const goal = await prisma.clientGoal.findFirst({
          where: { clientId, priority: 'PRIMARY', status: 'ACTIVE' },
        });
        if (!goal)
          throw new AppError(
            'PRIMARY_GOAL_REQUIRED',
            409,
            'Confirm a primary goal before continuing',
          );
        const goalStep = cycle.steps.find((step) => step.stage === 'STARTED');
        if (!goalStep)
          throw new AppError('GOAL_STEP_NOT_FOUND', 409, 'Goal confirmation step is unavailable');
        if (goalStep.status !== 'COMPLETE') {
          const nextStep = cycle.steps.find((step) => step.stage === 'REVIEW_PURCHASE');
          await prisma.$transaction(async (tx) => {
            await tx.applicationCycleStep.update({
              where: { id: goalStep.id },
              data: {
                status: 'COMPLETE',
                completedAt: new Date(),
                sourceType: 'ClientGoal',
                sourceId: goal.id,
              },
            });
            if (nextStep) {
              await tx.applicationCycleStep.update({
                where: { id: nextStep.id },
                data: { status: 'AVAILABLE', startedAt: new Date() },
              });
            }
            await tx.applicationCycle.update({
              where: { id: cycle.id },
              data: { currentStage: 'REVIEW_PURCHASE' },
            });
            await tx.auditEvent.create({
              data: {
                clientId,
                actorId: req.auth!.userId,
                action: 'APPLICATION_CYCLE_GOAL_CONFIRMED',
                entityType: 'ApplicationCycle',
                entityId: cycle.id,
                metadata: {
                  goalId: goal.id,
                  goalType: goal.goalType,
                  targetAmount: goal.targetAmount,
                  allowAnnualFee: goal.allowAnnualFee,
                },
              },
            });
          });
          publishLiveUpdate(clientId, 'application-cycles');
        }
        res.json({ confirmed: true, cycleId: cycle.id, goalId: goal.id });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/application-cycles/:cycleId/reset',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        if (process.env.NODE_ENV === 'production') {
          throw new AppError('DEVELOPMENT_ONLY', 404, 'Route not found');
        }
        const clientId = req.auth!.clientId!;
        const cycleId = Array.isArray(req.params.cycleId)
          ? req.params.cycleId[0]
          : req.params.cycleId;
        if (!cycleId)
          throw new AppError(
            'APPLICATION_CYCLE_NOT_FOUND',
            404,
            'Active application cycle not found',
          );
        const cycle = await prisma.applicationCycle.findFirst({
          where: { id: cycleId, clientId, status: 'ACTIVE' },
          include: { steps: true },
        });
        if (!cycle)
          throw new AppError(
            'APPLICATION_CYCLE_NOT_FOUND',
            404,
            'Active application cycle not found',
          );
        const goalStep = cycle.steps.find((step) => step.stage === 'STARTED');
        if (!goalStep)
          throw new AppError('GOAL_STEP_NOT_FOUND', 409, 'Goal confirmation step is unavailable');
        const reviewPurchaseStep = cycle.steps.find((step) => step.stage === 'REVIEW_PURCHASE');
        await prisma.$transaction(async (tx) => {
          const mockPurchase = await tx.servicePurchase.findFirst({
            where: {
              clientId,
              serviceType: 'CREDIT_PROFILE_REVIEW',
              OR: [
                ...(reviewPurchaseStep?.sourceId ? [{ id: reviewPurchaseStep.sourceId }] : []),
                { paymentReference: `DEV-MOCK-${cycle.id}` },
              ],
            },
            include: { creditReview: { select: { id: true } } },
          });
          if (mockPurchase?.creditReview) {
            await tx.workItem.deleteMany({
              where: { clientId, domain: 'CREDIT_REVIEW' },
            });
            await tx.creditReview.delete({ where: { id: mockPurchase.creditReview.id } });
          }
          if (mockPurchase) {
            await tx.servicePurchase.delete({ where: { id: mockPurchase.id } });
          }
          await tx.cycleApplication.deleteMany({ where: { cycleId: cycle.id } });
          await tx.applicationCycleStep.updateMany({
            where: { cycleId: cycle.id },
            data: {
              status: 'NOT_STARTED',
              startedAt: null,
              completedAt: null,
              sourceType: null,
              sourceId: null,
            },
          });
          await tx.applicationCycleStep.update({
            where: { id: goalStep.id },
            data: { status: 'AVAILABLE', startedAt: new Date() },
          });
          await tx.applicationCycle.update({
            where: { id: cycle.id },
            data: {
              currentStage: 'STARTED',
              readinessDecision: null,
              madeItToApplications: false,
              finalResult: null,
              closedAt: null,
            },
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'APPLICATION_CYCLE_RESET_DEVELOPMENT',
              entityType: 'ApplicationCycle',
              entityId: cycle.id,
              metadata: { cycleNumber: cycle.cycleNumber },
            },
          });
        });
        publishLiveUpdate(clientId, 'application-cycles');
        res.json({ reset: true, cycleId: cycle.id });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/application-cycles/:cycleId/mock-review-payment',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        if (process.env.NODE_ENV === 'production') {
          throw new AppError('DEVELOPMENT_ONLY', 404, 'Route not found');
        }
        const clientId = req.auth!.clientId!;
        const cycleId = Array.isArray(req.params.cycleId)
          ? req.params.cycleId[0]
          : req.params.cycleId;
        if (!cycleId)
          throw new AppError(
            'APPLICATION_CYCLE_NOT_FOUND',
            404,
            'Active application cycle not found',
          );
        const result = await prisma.$transaction(async (tx) => {
          const cycle = await tx.applicationCycle.findFirst({
            where: { id: cycleId, clientId, status: 'ACTIVE' },
            include: { steps: true },
          });
          if (!cycle)
            throw new AppError(
              'APPLICATION_CYCLE_NOT_FOUND',
              404,
              'Active application cycle not found',
            );
          const purchaseStep = cycle.steps.find((step) => step.stage === 'REVIEW_PURCHASE');
          const reviewStep = cycle.steps.find((step) => step.stage === 'CREDIT_REVIEW');
          if (!purchaseStep || !reviewStep)
            throw new AppError(
              'REVIEW_STEP_NOT_FOUND',
              409,
              'Credit Profile Review step is unavailable',
            );
          const definition = await tx.serviceDefinition.findUnique({
            where: { serviceType: 'CREDIT_PROFILE_REVIEW' },
          });
          if (!definition?.active)
            throw new AppError(
              'SERVICE_UNAVAILABLE',
              409,
              'Credit Profile Review is not available',
            );

          let review = await tx.creditReview.findFirst({
            where: { clientId, status: { notIn: ['COMPLETE', 'CANCELLED'] } },
          });
          let purchaseId = review?.purchaseId ?? null;
          if (!purchaseId) {
            const purchase = await tx.servicePurchase.create({
              data: {
                clientId,
                serviceType: 'CREDIT_PROFILE_REVIEW',
                amount: definition.price,
                currency: definition.currency,
                status: 'PAID',
                paymentProvider: 'MANUAL',
                paymentReference: `DEV-MOCK-${cycle.id}`,
                purchasedAt: new Date(),
              },
            });
            purchaseId = purchase.id;
          }
          if (!review) {
            review = await tx.creditReview.create({
              data: { clientId, purchaseId, status: 'INTAKE_REQUIRED', intake: { create: {} } },
            });
            await tx.workItem.create({
              data: {
                clientId,
                title: 'Complete Credit Profile Review intake',
                domain: 'CREDIT_REVIEW',
                priority: 'HIGH',
                suggestedNextAction: 'Upload report and confirm current information',
              },
            });
          } else if (!review.purchaseId) {
            review = await tx.creditReview.update({
              where: { id: review.id },
              data: { purchaseId },
            });
          }
          await tx.applicationCycleStep.update({
            where: { id: purchaseStep.id },
            data: {
              status: 'COMPLETE',
              completedAt: purchaseStep.completedAt ?? new Date(),
              sourceType: 'ServicePurchase',
              sourceId: purchaseId,
            },
          });
          await tx.applicationCycleStep.update({
            where: { id: reviewStep.id },
            data: { status: 'AVAILABLE', startedAt: reviewStep.startedAt ?? new Date() },
          });
          await tx.applicationCycle.update({
            where: { id: cycle.id },
            data: { currentStage: 'CREDIT_REVIEW' },
          });
          await tx.auditEvent.create({
            data: {
              clientId,
              actorId: req.auth!.userId,
              action: 'DEVELOPMENT_REVIEW_PAYMENT_COMPLETED',
              entityType: 'ServicePurchase',
              entityId: purchaseId,
              metadata: { cycleId: cycle.id, reviewId: review.id, amount: definition.price },
            },
          });
          return { purchaseId, reviewId: review.id };
        });
        publishLiveUpdate(clientId, 'application-cycles');
        res.status(201).json({ paid: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/client/support-categories', requireRole('CLIENT'), async (_req, res, next) => {
    try {
      const categories = await prisma.supportCategoryDefinition.findMany({
        where: { enabled: true, clientVisible: true },
        select: { key: true, name: true, allowedContextTypes: true },
        orderBy: { name: 'asc' },
      });
      res.json({ categories });
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/support-cases', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const query = supportListQuery.parse(req.query);
      const where = {
        clientId: req.auth!.clientId!,
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.search
          ? { subject: { contains: query.search, mode: 'insensitive' as const } }
          : {}),
      };
      const offset = (query.page - 1) * query.pageSize;
      const requestedActive = query.status
        ? activeSupportStatuses.includes(query.status as (typeof activeSupportStatuses)[number])
        : true;
      const requestedHistorical = query.status
        ? historicalSupportStatuses.includes(
            query.status as (typeof historicalSupportStatuses)[number],
          )
        : true;
      const [total, activeCount] = await prisma.$transaction([
        prisma.supportCase.count({ where }),
        requestedActive
          ? prisma.supportCase.count({
              where: {
                ...where,
                ...(!query.status ? { status: { in: [...activeSupportStatuses] } } : {}),
              },
            })
          : prisma.supportCase.count({ where: { id: { in: [] } } }),
      ]);
      const activeTake = requestedActive
        ? Math.max(0, Math.min(query.pageSize, activeCount - offset))
        : 0;
      const historicalSkip = Math.max(0, offset - activeCount);
      const historicalTake = requestedHistorical ? query.pageSize - activeTake : 0;
      const [activeCases, historicalCases] = await Promise.all([
        activeTake
          ? prisma.supportCase.findMany({
              where: {
                ...where,
                ...(!query.status ? { status: { in: [...activeSupportStatuses] } } : {}),
              },
              include: supportCaseInclude,
              orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
              skip: offset,
              take: activeTake,
            })
          : Promise.resolve([]),
        historicalTake
          ? prisma.supportCase.findMany({
              where: {
                ...where,
                ...(!query.status ? { status: { in: [...historicalSupportStatuses] } } : {}),
              },
              include: supportCaseInclude,
              orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
              skip: historicalSkip,
              take: historicalTake,
            })
          : Promise.resolve([]),
      ]);
      const cases = [...activeCases, ...historicalCases];
      const projected = await Promise.all(
        cases.map(async (item) => ({
          ...item,
          context: await supportContextProjection(prisma, item),
          unread: !item.clientReadAt || item.lastMessageAt > item.clientReadAt,
        })),
      );
      res.json({
        cases: projected,
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasMore: query.page * query.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/support-cases/:caseId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const supportCase = await prisma.supportCase.findFirst({
        where: { id: req.params.caseId as string, clientId: req.auth!.clientId! },
        include: supportCaseInclude,
      });
      if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
      await prisma.supportCase.update({
        where: { id: supportCase.id },
        data: { clientReadAt: new Date() },
      });
      res.json({
        case: {
          ...supportCase,
          context: await supportContextProjection(prisma, supportCase),
          unread: false,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/client/support-cases', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const parsed = supportCaseSchema.safeParse(req.body);
      if (!parsed.success)
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          parsed.error.issues[0]?.message ?? 'Check the support request details',
        );
      const clientId = req.auth!.clientId!;
      let context;
      let attachments;
      try {
        [context, attachments] = await Promise.all([
          resolveSupportContext(prisma, {
            clientId,
            category: parsed.data.category,
            contextType: parsed.data.contextType,
            contextResourceId: parsed.data.contextResourceId ?? null,
          }),
          resolveSupportAttachments(prisma, clientId, parsed.data.attachmentDocumentIds),
        ]);
      } catch (error) {
        mapSupportDomainError(error);
      }
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { assignedConsultantId: true, firstName: true, lastName: true },
      });
      if (!client) throw new AppError('NOT_FOUND', 404, 'Client account was not found');
      const now = new Date();
      const routing = routeSupportCase({
        category: parsed.data.category,
        priority: parsed.data.priority,
        createdAt: now,
        assignedConsultantId: client.assignedConsultantId,
      });
      const notificationRecipients = await getSupportNotificationRecipients(
        prisma,
        client.assignedConsultantId,
      );
      const key = supportIdempotencyKey(req, crypto.randomUUID());
      let command;
      try {
        command = await executeConsequentialCommand<{ supportCaseId: string }>(prisma, {
          idempotency: {
            scope: 'SUPPORT',
            subjectId: req.auth!.userId,
            operation: 'CREATE_TICKET',
            key,
            requestHash: requestHash(parsed.data),
          },
          audit: (result) => ({
            clientId,
            actorId: req.auth!.userId,
            action: 'SUPPORT_CASE_CREATED',
            entityType: 'SupportCase',
            entityId: result.supportCaseId,
            metadata: { category: parsed.data.category, contextType: parsed.data.contextType },
          }),
          outbox: {
            eventType: 'support.ticket.created',
            eventKey: `support.ticket.created:${key}`,
            aggregateType: 'SupportCase',
            aggregateId: (result) => result.supportCaseId,
            payload: (result) => ({
              clientId,
              domains: ['support', 'work-queue', 'notifications'],
              supportCaseId: result.supportCaseId,
            }),
          },
          mutate: async (tx) => {
            const supportCase = await tx.supportCase.create({
              data: {
                clientId,
                createdByUserId: req.auth!.userId,
                assignedToUserId: routing.assigneeId,
                routedQueue: routing.queue,
                slaDueAt: routing.slaDueAt,
                category: parsed.data.category,
                priority: parsed.data.priority,
                subject: parsed.data.subject,
                contextType: context!.type,
                contextResourceId: context!.resourceId,
                lastMessageAt: now,
                clientReadAt: now,
                messages: {
                  create: {
                    authorUserId: req.auth!.userId,
                    body: parsed.data.message,
                    idempotencyKey: key,
                  },
                },
                attachments: {
                  create: attachments!.map((document) => ({
                    documentId: document.id,
                    attachedByUserId: req.auth!.userId,
                  })),
                },
                assignmentEvents: {
                  create: {
                    actorUserId: req.auth!.userId,
                    toAssigneeId: routing.assigneeId,
                    eventType: routing.assigneeId ? 'ASSIGNED' : 'ROUTED',
                    reason: routing.reason,
                    version: 0,
                  },
                },
              },
            });
            await reconcileSupportAttention(tx, supportCase);
            if (notificationRecipients.length)
              await tx.notification.createMany({
                data: notificationRecipients.map((userId) => ({
                  userId,
                  clientId,
                  semanticKey: `support-case-created:${supportCase.id}`,
                  type: 'SUPPORT_MESSAGE',
                  category: 'SUPPORT',
                  title: 'New support request',
                  body: `${client.firstName} ${client.lastName}: ${parsed.data.subject}`,
                  link: `/crm/support?case=${supportCase.id}`,
                })),
                skipDuplicates: true,
              });
            return { supportCaseId: supportCase.id };
          },
        });
      } catch (error) {
        mapSupportDomainError(error);
      }
      const created = await prisma.supportCase.findUniqueOrThrow({
        where: { id: command.result.supportCaseId },
        include: supportCaseInclude,
      });
      publishLiveUpdate(clientId, 'support', 'work-queue');
      res.status(command.replayed ? 200 : 201).json({ case: created, replayed: command.replayed });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/client/support-cases/:caseId/messages',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const parsed = supportReplySchema.safeParse(req.body);
        if (!parsed.success)
          throw new AppError('VALIDATION_ERROR', 400, 'Enter a message before sending');
        const supportCase = await prisma.supportCase.findFirst({
          where: { id: req.params.caseId as string, clientId: req.auth!.clientId! },
          include: { client: { select: { assignedConsultantId: true } } },
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        const idempotencyKey = supportIdempotencyKey(
          req,
          parsed.data.idempotencyKey ?? crypto.randomUUID(),
        );
        const duplicate = await prisma.supportMessage.findFirst({
          where: {
            supportCaseId: supportCase.id,
            authorUserId: req.auth!.userId,
            idempotencyKey,
          },
          select: { id: true },
        });
        if (duplicate) {
          const current = await prisma.supportCase.findUniqueOrThrow({
            where: { id: supportCase.id },
            include: supportCaseInclude,
          });
          res.status(200).json({ case: current, replayed: true });
          return;
        }
        let nextStatus;
        try {
          nextStatus = supportReplyTransition(supportCase.status, 'CLIENT_VISIBLE_REPLY');
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          throw new AppError(code, 409, 'Reopen this support request before replying');
        }
        const now = new Date();
        const notificationRecipients = await getSupportNotificationRecipients(
          prisma,
          supportCase.assignedToUserId ?? supportCase.client.assignedConsultantId,
        );
        const updated = await prisma.$transaction(async (tx) => {
          await tx.supportMessage.create({
            data: {
              supportCaseId: supportCase.id,
              authorUserId: req.auth!.userId,
              body: parsed.data.message,
              idempotencyKey,
            },
          });
          const attentionCase = await tx.supportCase.update({
            where: { id: supportCase.id },
            data: { status: nextStatus, resolvedAt: null, lastMessageAt: now },
          });
          await reconcileSupportAttention(tx, attentionCase);
          if (notificationRecipients.length)
            await tx.notification.createMany({
              data: notificationRecipients.map((userId) => ({
                userId,
                clientId: supportCase.clientId,
                semanticKey: `support-client-message:${supportCase.id}:${now.getTime()}`,
                type: 'SUPPORT_MESSAGE',
                category: 'SUPPORT',
                title: 'New client message',
                body: supportCase.subject,
                link: `/consultant/support?case=${supportCase.id}`,
              })),
            });
          await tx.outboxEvent.create({
            data: {
              eventType: 'support.message.created',
              eventKey: `support.message.created:${supportCase.id}:${idempotencyKey}`,
              aggregateType: 'SupportCase',
              aggregateId: supportCase.id,
              payload: {
                clientId: supportCase.clientId,
                domains: ['support', 'notifications'],
                supportCaseId: supportCase.id,
              },
            },
          });
          await tx.auditEvent.create({
            data: {
              clientId: supportCase.clientId,
              actorId: req.auth!.userId,
              action: 'SUPPORT_MESSAGE_SENT',
              entityType: 'SupportCase',
              entityId: supportCase.id,
            },
          });
          return tx.supportCase.findUnique({
            where: { id: supportCase.id },
            include: supportCaseInclude,
          });
        });
        publishLiveUpdate(supportCase.clientId, 'support');
        res.status(201).json({ case: updated, replayed: false });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/client/support-cases/:caseId/status',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            status: z.enum(['OPEN', 'RESOLVED']),
            expectedUpdatedAt: z.iso.datetime().optional(),
          })
          .safeParse(req.body);
        if (!parsed.success)
          throw new AppError('VALIDATION_ERROR', 400, 'Choose a valid support status');
        const supportCase = await prisma.supportCase.findFirst({
          where: { id: req.params.caseId as string, clientId: req.auth!.clientId! },
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        if (
          parsed.data.expectedUpdatedAt &&
          supportCase.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt
        )
          throw new AppError(
            'STALE_SUPPORT_STATUS',
            409,
            'The support request changed; refresh it',
          );
        try {
          assertSupportTransition(supportCase.status, parsed.data.status);
        } catch {
          throw new AppError(
            'INVALID_SUPPORT_TRANSITION',
            409,
            'That status change is not allowed',
          );
        }
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.supportCase.update({
            where: { id: supportCase.id },
            data: {
              status: parsed.data.status,
              resolvedAt: parsed.data.status === 'RESOLVED' ? new Date() : null,
            },
            include: supportCaseInclude,
          });
          await reconcileSupportAttention(tx, changed);
          await tx.auditEvent.create({
            data: {
              clientId: supportCase.clientId,
              actorId: req.auth!.userId,
              action:
                parsed.data.status === 'RESOLVED'
                  ? 'SUPPORT_CASE_RESOLVED'
                  : 'SUPPORT_CASE_REOPENED',
              entityType: 'SupportCase',
              entityId: supportCase.id,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'support.ticket.status_changed',
              eventKey: `support.ticket.status_changed:${supportCase.id}:${changed.updatedAt.toISOString()}`,
              aggregateType: 'SupportCase',
              aggregateId: supportCase.id,
              payload: { clientId: supportCase.clientId, domains: ['support', 'work-queue'] },
            },
          });
          return changed;
        });
        publishLiveUpdate(supportCase.clientId, 'support', 'work-queue');
        res.json({ case: updated });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/consultant/support-cases', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const query = supportListQuery.parse(req.query);
      const clientIds = await authorizedSupportClientIds(prisma, authorization, req.auth!);
      const where = {
        clientId: { in: clientIds },
        ...(query.status ? { status: query.status } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.search
          ? {
              OR: [
                { subject: { contains: query.search, mode: 'insensitive' as const } },
                { client: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
                { client: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };
      const [cases, total] = await prisma.$transaction([
        prisma.supportCase.findMany({
          where,
          include: {
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                user: { select: { email: true } },
              },
            },
            messages: {
              orderBy: { createdAt: 'asc' },
              include: { author: { select: { id: true, role: true } } },
            },
            categoryDefinition: { select: { key: true, name: true } },
            attachments: { select: supportAttachmentProjection },
          },
          orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }, { id: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.supportCase.count({ where }),
      ]);
      const projected = await Promise.all(
        cases.map(async (item) => ({
          ...item,
          context: await supportContextProjection(prisma, item),
          unread: !item.staffReadAt || item.lastMessageAt > item.staffReadAt,
        })),
      );
      res.json({
        cases: projected,
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasMore: query.page * query.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/support-cases/:caseId',
    requireRole('CONSULTANT'),
    resolveSupportClient,
    requireCapability(authorization, 'support.manage', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const supportCase = await prisma.supportCase.findUnique({
          where: { id: req.params.caseId as string },
          include: staffSupportCaseInclude,
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        await prisma.supportCase.update({
          where: { id: supportCase.id },
          data: { staffReadAt: new Date() },
        });
        res.json({
          case: {
            ...supportCase,
            context: await supportContextProjection(prisma, supportCase),
            unread: false,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/support-cases/:caseId/messages',
    requireRole('CONSULTANT'),
    resolveSupportClient,
    requireCapability(authorization, 'support.manage', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const parsed = consultantSupportReplySchema.safeParse(req.body);
        if (!parsed.success)
          throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid support response');
        const supportCase = await prisma.supportCase.findFirst({
          where: {
            id: req.params.caseId as string,
          },
          include: { client: { select: { userId: true } } },
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        const idempotencyKey = supportIdempotencyKey(
          req,
          parsed.data.idempotencyKey ?? crypto.randomUUID(),
        );
        const duplicate = await prisma.supportMessage.findFirst({
          where: {
            supportCaseId: supportCase.id,
            authorUserId: req.auth!.userId,
            idempotencyKey,
          },
          select: { id: true },
        });
        if (duplicate) {
          res.status(200).json({ ok: true, replayed: true });
          return;
        }
        let nextStatus: typeof supportCase.status | null = null;
        if (!parsed.data.internal)
          try {
            nextStatus = supportReplyTransition(supportCase.status, 'CONSULTANT_VISIBLE_REPLY');
          } catch (error) {
            const code = error instanceof Error ? error.message : '';
            throw new AppError(code, 409, 'Reopen this support request before replying');
          }
        else if (supportCase.status === 'CLOSED')
          throw new AppError('SUPPORT_CASE_CLOSED', 409, 'This support request is closed');
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.supportMessage.create({
            data: {
              supportCaseId: supportCase.id,
              authorUserId: req.auth!.userId,
              body: parsed.data.message,
              internal: parsed.data.internal,
              idempotencyKey,
            },
          });
          const attentionCase = await tx.supportCase.update({
            where: { id: supportCase.id },
            data: {
              assignedToUserId: supportCase.assignedToUserId ?? req.auth!.userId,
              ...(parsed.data.internal
                ? {}
                : { status: nextStatus!, lastMessageAt: now, resolvedAt: null }),
            },
          });
          if (!parsed.data.internal) await reconcileSupportAttention(tx, attentionCase);
          if (!parsed.data.internal && supportCase.client.userId)
            await tx.notification.create({
              data: {
                userId: supportCase.client.userId,
                clientId: supportCase.clientId,
                semanticKey: `support-staff-reply:${supportCase.id}:${now.getTime()}`,
                type: 'SUPPORT_MESSAGE',
                category: 'SUPPORT',
                title: 'New support reply',
                body: supportCase.subject,
                link: `/app/support?case=${supportCase.id}`,
              },
            });
          await tx.outboxEvent.create({
            data: {
              eventType: 'support.message.created',
              eventKey: `support.message.created:${supportCase.id}:${idempotencyKey}`,
              aggregateType: 'SupportCase',
              aggregateId: supportCase.id,
              payload: {
                clientId: supportCase.clientId,
                domains: parsed.data.internal
                  ? ['support', 'work-queue']
                  : ['support', 'notifications'],
                supportCaseId: supportCase.id,
              },
            },
          });
          await tx.auditEvent.create({
            data: {
              clientId: supportCase.clientId,
              actorId: req.auth!.userId,
              action: parsed.data.internal ? 'SUPPORT_INTERNAL_NOTE_ADDED' : 'SUPPORT_REPLY_SENT',
              entityType: 'SupportCase',
              entityId: supportCase.id,
              metadata: { macroCode: parsed.data.macroCode ?? null },
            },
          });
        });
        publishLiveUpdate(supportCase.clientId, 'support');
        res.status(201).json({ ok: true, replayed: false });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/support-cases/:caseId/assignment',
    requireRole('CONSULTANT'),
    resolveSupportClient,
    requireCapability(authorization, 'support.manage', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const input = z.object({
          action: z.enum(['ASSIGN', 'REASSIGN', 'CLAIM', 'UNASSIGN', 'ESCALATE']),
          assigneeId: z.uuid().nullish(),
          expectedVersion: z.number().int().min(0),
          reason: z.string().trim().max(500).optional(),
        }).parse(req.body);
        const supportCase = await prisma.supportCase.findUnique({ where: { id: req.params.caseId as string } });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        const toAssigneeId: string | null = input.action === 'CLAIM' ? req.auth!.userId : input.action === 'UNASSIGN' ? null : input.assigneeId ?? null;
        if (input.action !== 'UNASSIGN' && !toAssigneeId)
          throw new AppError('VALIDATION_ERROR', 400, 'Choose an assignee');
        if (toAssigneeId) {
          const eligible = await prisma.user.findFirst({ where: { id: toAssigneeId, role: { in: ['CONSULTANT', 'ADMIN'] }, status: 'ACTIVE' }, select: { id: true } });
          if (!eligible) throw new AppError('VALIDATION_ERROR', 400, 'Choose an active staff member');
        }
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.supportCase.updateMany({
            where: { id: supportCase.id, assignmentVersion: input.expectedVersion },
            data: {
              assignedToUserId: toAssigneeId,
              assignmentVersion: { increment: 1 },
              ...(input.action === 'ESCALATE' ? { escalatedAt: new Date(), priority: 'URGENT' as const } : {}),
            },
          });
          if (changed.count !== 1) throw new AppError('STALE_SUPPORT_ASSIGNMENT', 409, 'Assignment changed; refresh it');
          const current = await tx.supportCase.findUniqueOrThrow({ where: { id: supportCase.id } });
          await tx.supportAssignmentEvent.create({ data: {
            supportCaseId: supportCase.id,
            actorUserId: req.auth!.userId,
            fromAssigneeId: supportCase.assignedToUserId,
            toAssigneeId,
            eventType: input.action,
            ...(input.reason ? { reason: input.reason } : {}),
            version: current.assignmentVersion,
          } });
          await tx.auditEvent.create({ data: { clientId: supportCase.clientId, actorId: req.auth!.userId, action: `SUPPORT_${input.action}`, entityType: 'SupportCase', entityId: supportCase.id, metadata: { fromAssigneeId: supportCase.assignedToUserId, toAssigneeId, version: current.assignmentVersion } } });
          await tx.outboxEvent.create({ data: { eventType: 'support.assignment.changed', eventKey: `support.assignment.changed:${supportCase.id}:${current.assignmentVersion}`, aggregateType: 'SupportCase', aggregateId: supportCase.id, payload: { clientId: supportCase.clientId, domains: ['support', 'work-queue'] } } });
          return current;
        });
        publishLiveUpdate(supportCase.clientId, 'support', 'work-queue');
        res.json({ case: updated });
      } catch (error) { next(error); }
    },
  );
  router.patch(
    '/consultant/support-cases/:caseId',
    requireRole('CONSULTANT'),
    resolveSupportClient,
    requireCapability(authorization, 'support.manage', 'clientId', undefined, denialRecorder),
    async (req, res, next) => {
      try {
        const parsed = z
          .object({
            status: z
              .enum(['OPEN', 'WAITING_ON_SUPPORT', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED'])
              .optional(),
            priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).optional(),
            expectedUpdatedAt: z.iso.datetime().optional(),
          })
          .refine((value) => value.status || value.priority, {
            message: 'Select at least one support update',
          })
          .safeParse(req.body);
        if (!parsed.success)
          throw new AppError(
            'VALIDATION_ERROR',
            400,
            parsed.error.issues[0]?.message ?? 'Choose a valid support update',
          );
        const supportCase = await prisma.supportCase.findFirst({
          where: {
            id: req.params.caseId as string,
          },
          include: { client: { select: { userId: true } } },
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        if (
          parsed.data.expectedUpdatedAt &&
          supportCase.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt
        )
          throw new AppError(
            'STALE_SUPPORT_STATUS',
            409,
            'The support request changed; refresh it',
          );
        if (parsed.data.status)
          try {
            assertSupportTransition(supportCase.status, parsed.data.status);
          } catch {
            throw new AppError(
              'INVALID_SUPPORT_TRANSITION',
              409,
              'That status change is not allowed',
            );
          }
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.supportCase.update({
            where: { id: supportCase.id },
            data: {
              ...(parsed.data.status ? { status: parsed.data.status } : {}),
              ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
              ...(parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED'
                ? { resolvedAt: new Date() }
                : parsed.data.status
                  ? { resolvedAt: null, ...(supportCase.status === 'RESOLVED' ? { reopenedAt: new Date() } : {}) }
                  : {}),
            },
          });
          await reconcileSupportAttention(tx, changed);
          await tx.auditEvent.create({
            data: {
              clientId: supportCase.clientId,
              actorId: req.auth!.userId,
              action: 'SUPPORT_CASE_UPDATED',
              entityType: 'SupportCase',
              entityId: supportCase.id,
              metadata: parsed.data,
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'support.ticket.status_changed',
              eventKey: `support.ticket.status_changed:${supportCase.id}:${changed.updatedAt.toISOString()}`,
              aggregateType: 'SupportCase',
              aggregateId: supportCase.id,
              payload: {
                clientId: supportCase.clientId,
                domains: ['support', 'work-queue', 'notifications'],
              },
            },
          });
          if (parsed.data.status && supportCase.client.userId)
            await tx.notification.create({
              data: {
                userId: supportCase.client.userId,
                clientId: supportCase.clientId,
                semanticKey: `support-status:${supportCase.id}:${changed.updatedAt.toISOString()}`,
                type: 'SUPPORT_STATUS',
                category: 'SUPPORT',
                title: 'Support request updated',
                body: supportCase.subject,
                link: `/app/support?case=${supportCase.id}`,
              },
            });
          return changed;
        });
        publishLiveUpdate(supportCase.clientId, 'support', 'work-queue');
        res.json({ case: updated });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/client/credit-plan', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const clientId = req.auth!.clientId!;
      const [actions, reviews, majorAssessments] = await Promise.all([
        prisma.planAction.findMany({
          where: { clientId, status: { not: 'CANCELLED' } },
          orderBy: [{ sortOrder: 'asc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.creditReview.findMany({
          where: { clientId, status: 'COMPLETE' },
          select: { id: true, completedAt: true, generalReadiness: true, recommendation: true },
          orderBy: { completedAt: 'desc' },
          take: 20,
        }),
        prisma.readinessAssessment.findMany({
          where: { clientId, status: 'CONFIRMED' },
          select: { id: true, confirmedAt: true, outcome: true, riskLevel: true },
          orderBy: { confirmedAt: 'desc' },
          take: 20,
        }),
      ]);
      res.json({ actions, history: { reviews, majorAssessments } });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/dashboard',
    requireRole('CONSULTANT', 'ADMIN'),
    async (req, res, next) => {
      try {
        const assigned = req.auth!.role === 'ADMIN' ? {} : { assigneeId: req.auth!.userId };
        const clientScope =
          req.auth!.role === 'ADMIN' ? {} : { assignedConsultantId: req.auth!.userId };
        const [open, dueToday, activeClients, reviews, readiness] = await Promise.all([
          prisma.workItem.count({
            where: { ...assigned, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          }),
          prisma.workItem.count({
            where: {
              ...assigned,
              status: { in: ['OPEN', 'IN_PROGRESS'] },
              dueAt: { lte: new Date(new Date().setHours(23, 59, 59, 999)) },
            },
          }),
          prisma.client.count({ where: { ...clientScope, status: 'ACTIVE' } }),
          prisma.creditReview.count({
            where: {
              status: { in: ['INFORMATION_RECEIVED', 'CONSULTANT_REVIEW'] },
              client: clientScope,
            },
          }),
          prisma.readinessAssessment.count({
            where: { status: { in: ['DRAFT', 'IN_REVIEW'] }, client: clientScope },
          }),
        ]);
        res.json({ metrics: { open, dueToday, activeClients, reviews, readiness } });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/consultant/work-queue', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const query = z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']).optional(),
          priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
          assignment: z.enum(['MINE', 'UNASSIGNED', 'ALL']).default('ALL'),
          search: z.string().trim().max(100).optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const candidates = await prisma.workItem.findMany({
        where: { sourceType: 'SUPPORT_CASE' },
        distinct: ['clientId'],
        select: { clientId: true },
      });
      const allowed = (
        await Promise.all(
          candidates.map(async ({ clientId }) => ({
            clientId,
            allowed: await authorization.authorize(req.auth!, 'support.manage', {
              type: 'client',
              clientId,
            }),
          })),
        )
      )
        .filter((item) => item.allowed)
        .map((item) => item.clientId);
      const where = {
        clientId: { in: allowed },
        sourceType: 'SUPPORT_CASE',
        ...(query.status
          ? { status: query.status }
          : { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] as WorkItemStatus[] } }),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assignment === 'MINE'
          ? { assigneeId: req.auth!.userId }
          : query.assignment === 'UNASSIGNED'
            ? { assigneeId: null }
            : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' as const } },
                { client: { firstName: { contains: query.search, mode: 'insensitive' as const } } },
                { client: { lastName: { contains: query.search, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };
      const [items, total, open, urgent, mine, unassigned] = await prisma.$transaction([
        prisma.workItem.findMany({
          where,
          include: {
            client: { select: { firstName: true, lastName: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: workQueueOrderBy(),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.workItem.count({ where }),
        prisma.workItem.count({
          where: {
            clientId: { in: allowed },
            sourceType: 'SUPPORT_CASE',
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
          },
        }),
        prisma.workItem.count({
          where: {
            clientId: { in: allowed },
            sourceType: 'SUPPORT_CASE',
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            priority: 'URGENT',
          },
        }),
        prisma.workItem.count({
          where: {
            clientId: { in: allowed },
            sourceType: 'SUPPORT_CASE',
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            assigneeId: req.auth!.userId,
          },
        }),
        prisma.workItem.count({
          where: {
            clientId: { in: allowed },
            sourceType: 'SUPPORT_CASE',
            status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            assigneeId: null,
          },
        }),
      ]);
      res.json({
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        counts: { open, urgent, mine, unassigned },
      });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/consultant/work-queue/:workItemId/claim',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const input = z.object({ expectedVersion: z.number().int().min(0) }).parse(req.body);
        const item = await prisma.workItem.findUnique({
          where: { id: req.params.workItemId as string },
        });
        if (!item || item.sourceType !== 'SUPPORT_CASE')
          throw new AppError('NOT_FOUND', 404, 'Attention item was not found');
        if (
          !(await authorization.authorize(req.auth!, 'support.manage', {
            type: 'client',
            clientId: item.clientId,
          }))
        )
          throw new AppError('FORBIDDEN', 403, 'You do not have access to this attention item');
        const claimDecision = attentionClaimDecision(item, req.auth!.userId, input.expectedVersion);
        if (claimDecision === 'REPLAY') return res.json({ item, replayed: true });
        if (claimDecision === 'NON_ACTIONABLE') {
          await recordAttentionClaimConflict(prisma, {
            clientId: item.clientId,
            actorId: req.auth!.userId,
            workItemId: item.id,
            category: 'NON_ACTIONABLE',
          });
          throw new AppError(
            'ATTENTION_ITEM_NOT_ACTIONABLE',
            409,
            'This item is no longer actionable',
          );
        }
        if (claimDecision === 'STALE') {
          await recordAttentionClaimConflict(prisma, {
            clientId: item.clientId,
            actorId: req.auth!.userId,
            workItemId: item.id,
            category: item.version !== input.expectedVersion ? 'STALE_VERSION' : 'ALREADY_CLAIMED',
          });
          throw new AppError('STALE_ATTENTION_ITEM', 409, 'This item changed; refresh the queue');
        }
        const updated = await prisma.$transaction(async (tx) => {
          const claimed = await tx.workItem.updateMany({
            where: {
              id: item.id,
              assigneeId: null,
              version: input.expectedVersion,
              status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
            },
            data: {
              assigneeId: req.auth!.userId,
              claimedAt: new Date(),
              status: 'IN_PROGRESS',
              version: { increment: 1 },
            },
          });
          if (claimed.count !== 1) return null;
          const result = await tx.workItem.findUniqueOrThrow({ where: { id: item.id } });
          await tx.auditEvent.create({
            data: {
              clientId: item.clientId,
              actorId: req.auth!.userId,
              action: 'ATTENTION_ITEM_CLAIMED',
              entityType: 'WorkItem',
              entityId: item.id,
              metadata: { version: result.version },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'attention.item.claimed',
              eventKey: `attention.item.claimed:${item.id}:${result.version}`,
              aggregateType: 'WorkItem',
              aggregateId: item.id,
              payload: { clientId: item.clientId, domains: ['work-queue'], workItemId: item.id },
            },
          });
          return result;
        });
        if (!updated) {
          await recordAttentionClaimConflict(prisma, {
            clientId: item.clientId,
            actorId: req.auth!.userId,
            workItemId: item.id,
            category: 'CONCURRENT_CLAIM',
          });
          throw new AppError('STALE_ATTENTION_ITEM', 409, 'This item changed; refresh the queue');
        }
        publishLiveUpdate(item.clientId, 'work-queue');
        res.json({ item: updated, replayed: false });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/work-items',
    requireRole('CONSULTANT', 'ADMIN'),
    async (req, res, next) => {
      try {
        const status = z
          .enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'])
          .optional()
          .parse(req.query.status?.toString()) as WorkItemStatus | undefined;
        const items = await prisma.workItem.findMany({
          where: {
            ...(req.auth!.role === 'ADMIN'
              ? {}
              : { OR: [{ assigneeId: req.auth!.userId }, { assigneeId: null }] }),
            ...(status ? { status } : { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } }),
          },
          include: { client: { select: { firstName: true, lastName: true } } },
          orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }, { createdAt: 'asc' }],
          take: 200,
        });
        res.json({ items });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/consultant/work-items/:workItemId',
    requireRole('CONSULTANT', 'ADMIN'),
    async (req, res, next) => {
      try {
        const input = z
          .object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']) })
          .safeParse(req.body);
        if (!input.success)
          throw new AppError('VALIDATION_ERROR', 400, 'A valid work item status is required');
        const item = await prisma.workItem.findUnique({
          where: { id: req.params.workItemId as string },
        });
        if (!item) throw new AppError('NOT_FOUND', 404, 'Work item was not found');
        if (item.sourceType)
          throw new AppError(
            'DOMAIN_STATE_REQUIRED',
            409,
            'Resolve this attention item in its linked workspace',
          );
        if (req.auth!.role !== 'ADMIN' && item.assigneeId && item.assigneeId !== req.auth!.userId)
          throw new AppError('FORBIDDEN', 403, 'This work item belongs to another consultant');
        const updated = await prisma.workItem.update({
          where: { id: item.id },
          data: {
            status: input.data.status,
            assigneeId: item.assigneeId ?? req.auth!.userId,
            completedAt: input.data.status === 'COMPLETED' ? new Date() : null,
          },
        });
        await prisma.auditEvent.create({
          data: {
            clientId: item.clientId,
            actorId: req.auth!.userId,
            action: 'WORK_ITEM_STATUS_CHANGED',
            entityType: 'WorkItem',
            entityId: item.id,
            metadata: { status: input.data.status },
          },
        });
        res.json({ item: updated });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/consultant/clients', requireRole('CONSULTANT', 'ADMIN'), async (req, res, next) => {
    try {
      const clients = await prisma.client.findMany({
        where:
          req.auth!.role === 'ADMIN'
            ? { status: 'ACTIVE' }
            : { status: 'ACTIVE', assignedConsultantId: req.auth!.userId },
        include: {
          goals: { where: { status: 'ACTIVE' }, orderBy: { priority: 'asc' }, take: 1 },
          creditReviews: {
            where: { status: 'COMPLETE' },
            orderBy: { completedAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              planActions: { where: { status: { in: ['READY', 'IN_PROGRESS', 'BLOCKED'] } } },
              workItems: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } },
            },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        take: 200,
      });
      res.json({
        clients: clients.map((c) => ({
          ...c,
          goals: c.goals.map((g) => ({
            ...g,
            targetAmount: g.targetAmount?.toNumber() ?? null,
            currentAmount: g.currentAmount?.toNumber() ?? null,
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/clients/:clientId',
    requireRole('CONSULTANT', 'ADMIN'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        const client = await prisma.client.findUnique({
          where: { id: req.params.clientId as string },
          include: {
            goals: true,
            creditReviews: { orderBy: { createdAt: 'desc' }, take: 5, include: { snapshot: true } },
            planActions: {
              where: { status: { not: 'CANCELLED' } },
              orderBy: [{ sortOrder: 'asc' }, { dueAt: 'asc' }],
            },
            servicePurchases: { orderBy: { createdAt: 'desc' }, take: 20 },
            readinessAssessments: { orderBy: { version: 'desc' }, take: 5 },
          },
        });
        if (!client) throw new AppError('NOT_FOUND', 404, 'Client was not found');
        res.json({ client });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
