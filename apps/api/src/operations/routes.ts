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
import type { PrismaClient, WorkItemStatus } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { publishLiveUpdate, subscribeToLiveUpdates, type LiveUpdate } from '../liveUpdates.js';
import {
  createPrismaAuthorizationService,
  createPrismaAuthorizationDenialRecorder,
  createRealtimeAuthorizationBridge,
  type AuthorizationService,
} from '../authorization/authorizationService.js';

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
});
const supportReplySchema = z.object({ message: z.string().trim().min(1).max(5000) });
const consultantSupportReplySchema = supportReplySchema.extend({
  internal: z.boolean().default(false),
  macroCode: z.string().trim().max(80).nullish(),
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
} as const;

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
        const created = await tx.applicationCycle.create({
          data: {
            clientId,
            cycleNumber: (latest?.cycleNumber ?? 0) + 1,
            currentStage: 'STARTED',
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
  router.get('/client/support-cases', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const cases = await prisma.supportCase.findMany({
        where: { clientId: req.auth!.clientId! },
        include: supportCaseInclude,
        orderBy: { lastMessageAt: 'desc' },
      });
      res.json({ cases });
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
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { assignedConsultantId: true, firstName: true, lastName: true },
      });
      if (!client) throw new AppError('NOT_FOUND', 404, 'Client account was not found');
      const now = new Date();
      const dueHours =
        parsed.data.priority === 'URGENT' ? 4 : parsed.data.priority === 'HIGH' ? 24 : 48;
      const notificationRecipients = await getSupportNotificationRecipients(
        prisma,
        client.assignedConsultantId,
      );
      const created = await prisma.$transaction(async (tx) => {
        const supportCase = await tx.supportCase.create({
          data: {
            clientId,
            createdByUserId: req.auth!.userId,
            assignedToUserId: client.assignedConsultantId,
            category: parsed.data.category,
            priority: parsed.data.priority,
            subject: parsed.data.subject,
            lastMessageAt: now,
            messages: {
              create: { authorUserId: req.auth!.userId, body: parsed.data.message },
            },
          },
        });
        await tx.workItem.create({
          data: {
            clientId,
            assigneeId: client.assignedConsultantId,
            domain: 'SUPPORT',
            title: `Support: ${parsed.data.subject}`,
            priority:
              parsed.data.priority === 'URGENT'
                ? 'URGENT'
                : parsed.data.priority === 'HIGH'
                  ? 'HIGH'
                  : 'NORMAL',
            suggestedNextAction: 'Review and respond to client',
            dueAt: new Date(now.getTime() + dueHours * 60 * 60 * 1000),
          },
        });
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
              link: `/consultant/support?case=${supportCase.id}`,
            })),
          });
        await tx.auditEvent.create({
          data: {
            clientId,
            actorId: req.auth!.userId,
            action: 'SUPPORT_CASE_CREATED',
            entityType: 'SupportCase',
            entityId: supportCase.id,
            metadata: { category: parsed.data.category, priority: parsed.data.priority },
          },
        });
        return tx.supportCase.findUnique({
          where: { id: supportCase.id },
          include: supportCaseInclude,
        });
      });
      publishLiveUpdate(clientId, 'support', 'work-queue');
      res.status(201).json({ case: created });
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
        if (supportCase.status === 'CLOSED')
          throw new AppError('CASE_CLOSED', 409, 'This support request is closed');
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
            },
          });
          await tx.supportCase.update({
            where: { id: supportCase.id },
            data: { status: 'WAITING_ON_SUPPORT', resolvedAt: null, lastMessageAt: now },
          });
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
        res.status(201).json({ case: updated });
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
        const parsed = z.object({ status: z.enum(['OPEN', 'RESOLVED']) }).safeParse(req.body);
        if (!parsed.success)
          throw new AppError('VALIDATION_ERROR', 400, 'Choose a valid support status');
        const supportCase = await prisma.supportCase.findFirst({
          where: { id: req.params.caseId as string, clientId: req.auth!.clientId! },
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        const updated = await prisma.supportCase.update({
          where: { id: supportCase.id },
          data: {
            status: parsed.data.status,
            resolvedAt: parsed.data.status === 'RESOLVED' ? new Date() : null,
          },
          include: supportCaseInclude,
        });
        await prisma.auditEvent.create({
          data: {
            clientId: supportCase.clientId,
            actorId: req.auth!.userId,
            action:
              parsed.data.status === 'RESOLVED' ? 'SUPPORT_CASE_RESOLVED' : 'SUPPORT_CASE_REOPENED',
            entityType: 'SupportCase',
            entityId: supportCase.id,
          },
        });
        publishLiveUpdate(supportCase.clientId, 'support', 'work-queue');
        res.json({ case: updated });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/consultant/support-cases',
    requireRole('CONSULTANT', 'ADMIN'),
    async (req, res, next) => {
      try {
        const cases = await prisma.supportCase.findMany({
          where:
            req.auth!.role === 'ADMIN'
              ? {}
              : {
                  OR: [
                    { assignedToUserId: req.auth!.userId },
                    {
                      assignedToUserId: null,
                      client: { assignedConsultantId: req.auth!.userId },
                    },
                  ],
                },
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
          },
          orderBy: [{ priority: 'desc' }, { lastMessageAt: 'desc' }],
          take: 300,
        });
        res.json({ cases });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/consultant/support-cases/:caseId/messages',
    requireRole('CONSULTANT', 'ADMIN'),
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
        if (supportCase.status === 'CLOSED')
          throw new AppError('CASE_CLOSED', 409, 'This support request is closed');
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.supportMessage.create({
            data: {
              supportCaseId: supportCase.id,
              authorUserId: req.auth!.userId,
              body: parsed.data.message,
              internal: parsed.data.internal,
            },
          });
          await tx.supportCase.update({
            where: { id: supportCase.id },
            data: {
              assignedToUserId: supportCase.assignedToUserId ?? req.auth!.userId,
              ...(parsed.data.internal
                ? {}
                : { status: 'WAITING_ON_CLIENT', lastMessageAt: now, resolvedAt: null }),
            },
          });
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
        res.status(201).json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch(
    '/consultant/support-cases/:caseId',
    requireRole('CONSULTANT', 'ADMIN'),
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
        });
        if (!supportCase) throw new AppError('NOT_FOUND', 404, 'Support request was not found');
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.supportCase.update({
            where: { id: supportCase.id },
            data: {
              ...(parsed.data.status ? { status: parsed.data.status } : {}),
              ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
              ...(parsed.data.status === 'RESOLVED' || parsed.data.status === 'CLOSED'
                ? { resolvedAt: new Date() }
                : parsed.data.status
                  ? { resolvedAt: null }
                  : {}),
            },
          });
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
