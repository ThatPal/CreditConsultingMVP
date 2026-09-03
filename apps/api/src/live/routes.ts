import { Router } from 'express';
import { z } from 'zod';
import {
  requireCapability,
  requireRole,
  type AuthorizationDenialRecorder,
} from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import {
  availableSlots,
  bookAppointment,
  cancelAppointment,
  currentAppointment,
  rescheduleAppointment,
} from './appointments.js';
import {
  assertSessionParticipant,
  heartbeatPresence,
  sendSessionMessage,
  sessionSnapshot,
  startApplicationSession,
} from './sessions.js';

const key = z.string().min(8).max(160);

export function createLiveRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  recorder?: AuthorizationDenialRecorder,
) {
  const router = Router();
  router.get(
    '/client/rounds/:roundId/appointment-slots',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        res.json(
          await availableSlots(prisma, {
            roundId: req.params.roundId as string,
            clientId: req.auth!.clientId!,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/client/rounds/:roundId/appointment',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        res.json({
          appointment: await currentAppointment(
            prisma,
            req.params.roundId as string,
            req.auth!.clientId!,
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/rounds/:roundId/appointments',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            startsAt: z.coerce.date(),
            timezone: z.string().min(1).max(80),
            idempotencyKey: key,
          })
          .parse(req.body);
        const result = await bookAppointment(prisma, {
          roundId: req.params.roundId as string,
          clientId: req.auth!.clientId!,
          actorId: req.auth!.userId,
          ...body,
        });
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/appointments/:appointmentId/cancel',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const body = z
          .object({ reason: z.string().min(1).max(500), idempotencyKey: key })
          .parse(req.body);
        res.json(
          await cancelAppointment(prisma, {
            appointmentId: req.params.appointmentId as string,
            clientId: req.auth!.clientId!,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/client/appointments/:appointmentId/reschedule',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const body = z
          .object({
            startsAt: z.coerce.date(),
            timezone: z.string().min(1).max(80),
            idempotencyKey: key,
          })
          .parse(req.body);
        res.json(
          await rescheduleAppointment(prisma, {
            appointmentId: req.params.appointmentId as string,
            clientId: req.auth!.clientId!,
            actorId: req.auth!.userId,
            ...body,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/consultant/calendar', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const allowed = await authorization.authorizeCapability(req.auth!, 'strategy.read');
      if (!allowed) throw new AppError('FORBIDDEN', 403, 'Calendar access is not permitted');
      const appointments = await prisma.appointment.findMany({
        where: { consultantId: req.auth!.userId },
        select: {
          id: true,
          clientId: true,
          roundId: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          status: true,
          externalSyncStatus: true,
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 200,
      });
      res.json({ appointments });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/consultant/clients/:clientId/appointments/:appointmentId',
    requireRole('CONSULTANT'),
    requireCapability(authorization, 'strategy.read', 'clientId', undefined, recorder),
    async (req, res, next) => {
      try {
        const appointment = await prisma.appointment.findFirst({
          where: {
            id: req.params.appointmentId as string,
            clientId: req.params.clientId as string,
          },
        });
        if (!appointment)
          throw new AppError('APPOINTMENT_NOT_FOUND', 404, 'Appointment was not found');
        res.json({ appointment });
      } catch (error) {
        next(error);
      }
    },
  );
  router.put('/consultant/availability', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const allowed = await authorization.authorizeCapability(req.auth!, 'strategy.manage');
      if (!allowed)
        throw new AppError('FORBIDDEN', 403, 'Availability management is not permitted');
      const rules = z
        .array(
          z.object({
            weekday: z.number().int().min(0).max(6),
            startMinute: z.number().int().min(0).max(1439),
            endMinute: z.number().int().min(1).max(1440),
            timezone: z.string().min(1).max(80),
          }),
        )
        .min(1)
        .max(21)
        .parse(req.body?.rules);
      await prisma.$transaction(async (tx) => {
        await tx.consultantAvailabilityRule.deleteMany({
          where: { consultantId: req.auth!.userId },
        });
        await tx.consultantAvailabilityRule.createMany({
          data: rules.map((rule) => ({ ...rule, consultantId: req.auth!.userId })),
        });
      });
      res.json({ saved: rules.length });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/consultant/appointments/:appointmentId/session',
    requireRole('CONSULTANT'),
    async (req, res, next) => {
      try {
        const allowed = await authorization.authorizeCapability(req.auth!, 'strategy.manage');
        if (!allowed)
          throw new AppError('FORBIDDEN', 403, 'Live session supervision is not permitted');
        const body = z.object({ idempotencyKey: key }).parse(req.body);
        const result = await startApplicationSession(prisma, {
          appointmentId: req.params.appointmentId as string,
          consultantId: req.auth!.userId,
          actorId: req.auth!.userId,
          ...body,
        });
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/sessions/:sessionId', async (req, res, next) => {
    try {
      await assertSessionParticipant(prisma, req.params.sessionId as string, req.auth!);
      res.json(await sessionSnapshot(prisma, req.params.sessionId as string));
    } catch (error) {
      next(error);
    }
  });
  router.post('/sessions/:sessionId/presence', async (req, res, next) => {
    try {
      const session = await assertSessionParticipant(
        prisma,
        req.params.sessionId as string,
        req.auth!,
      );
      const body = z.object({ connectionId: z.string().min(8).max(160) }).parse(req.body);
      const role = req.auth!.role === 'CLIENT' ? 'CLIENT' : 'CONSULTANT';
      res.json(
        await heartbeatPresence(prisma, {
          sessionId: session.id,
          userId: req.auth!.userId,
          role,
          connectionId: body.connectionId,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.post('/sessions/:sessionId/messages', async (req, res, next) => {
    try {
      const session = await assertSessionParticipant(
        prisma,
        req.params.sessionId as string,
        req.auth!,
      );
      const body = z
        .object({ body: z.string().trim().min(1).max(2000), idempotencyKey: key })
        .parse(req.body);
      const role = req.auth!.role === 'CLIENT' ? 'CLIENT' : 'CONSULTANT';
      res.json(
        await sendSessionMessage(prisma, {
          sessionId: session.id,
          clientId: session.clientId,
          actorId: req.auth!.userId,
          role,
          ...body,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/rounds/:roundId/session', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const session = await prisma.applicationSession.findFirst({
        where: { roundId: req.params.roundId as string, clientId: req.auth!.clientId! },
        select: { id: true },
      });
      res.json({ sessionId: session?.id ?? null });
    } catch (error) {
      next(error);
    }
  });
  router.get('/consultant/live-sessions', requireRole('CONSULTANT'), async (req, res, next) => {
    try {
      const sessions = await prisma.applicationSession.findMany({
        where: { consultantId: req.auth!.userId },
        select: {
          id: true,
          clientId: true,
          roundId: true,
          appointmentId: true,
          status: true,
          pauseReason: true,
          startedAt: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 200,
      });
      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
