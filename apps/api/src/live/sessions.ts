import { createHash } from 'node:crypto';
import {
  Prisma,
  type PrismaClient,
  type SessionParticipantRole,
} from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const JOIN_WINDOW_MS = 30 * 60_000;
const PRESENCE_LEASE_MS = 90_000;

export async function assertSessionParticipant(
  prisma: PrismaClient,
  sessionId: string,
  principal: { userId: string; clientId?: string | null; role: string },
) {
  const session = await prisma.applicationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('SESSION_NOT_FOUND', 404, 'Live session was not found');
  const clientAllowed = principal.role === 'CLIENT' && principal.clientId === session.clientId;
  const consultantAllowed =
    principal.role === 'CONSULTANT' && principal.userId === session.consultantId;
  if (!clientAllowed && !consultantAllowed)
    throw new AppError('FORBIDDEN', 403, 'Live session access is not permitted');
  return session;
}

export async function startApplicationSession(
  prisma: PrismaClient,
  input: { appointmentId: string; consultantId: string; actorId: string; idempotencyKey: string },
) {
  const appointment = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
  if (
    !appointment ||
    appointment.consultantId !== input.consultantId ||
    appointment.status !== 'BOOKED'
  )
    throw new AppError('APPOINTMENT_NOT_JOINABLE', 409, 'Appointment is not joinable');
  const now = Date.now();
  if (
    now < appointment.startsAt.getTime() - JOIN_WINDOW_MS ||
    now > appointment.endsAt.getTime() + JOIN_WINDOW_MS
  )
    throw new AppError(
      'APPOINTMENT_OUTSIDE_JOIN_WINDOW',
      409,
      'Appointment is outside its join window',
    );
  const round = await prisma.creditCardRound.findUnique({
    where: { id: appointment.roundId },
    include: { strategy: { include: { approvedVersion: true } } },
  });
  if (
    !round?.strategy?.approvedVersion ||
    round.strategy.status !== 'APPROVED' ||
    round.strategy.approvedVersion.id !== appointment.strategyVersionId
  )
    throw new AppError('STRATEGY_NOT_CURRENT', 409, 'Approved Strategy is no longer current');
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'consultant',
      subjectId: input.consultantId,
      operation: 'session.start',
      key: input.idempotencyKey,
      requestHash: digest({ appointmentId: input.appointmentId }),
    },
    audit: (result) => ({
      action: 'APPLICATION_SESSION_STARTED',
      entityType: 'ApplicationSession',
      entityId: String((result as { id: string }).id),
      clientId: appointment.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'session.started',
      eventKey: `session:${appointment.roundId}:start`,
      aggregateType: 'ApplicationSession',
      aggregateId: (result) => String((result as { id: string }).id),
      payload: (result) => ({
        clientId: appointment.clientId,
        domains: ['live-session'],
        sessionId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const session = await tx.applicationSession.upsert({
        where: { roundId: appointment.roundId },
        update: {},
        create: {
          clientId: appointment.clientId,
          consultantId: input.consultantId,
          roundId: appointment.roundId,
          appointmentId: appointment.id,
          strategyVersionId: appointment.strategyVersionId,
          sourceFingerprint: round.sourceFingerprint,
          status: 'WAITING_FOR_CLIENT',
          startedAt: new Date(),
        },
      });
      return {
        id: session.id,
        status: session.status,
        version: session.version,
      } as Prisma.InputJsonObject;
    },
  });
}

export async function heartbeatPresence(
  prisma: PrismaClient,
  input: { sessionId: string; userId: string; role: SessionParticipantRole; connectionId: string },
) {
  const lease = await prisma.sessionPresenceLease.upsert({
    where: {
      sessionId_connectionId: { sessionId: input.sessionId, connectionId: input.connectionId },
    },
    update: {
      expiresAt: new Date(Date.now() + PRESENCE_LEASE_MS),
      lastSeenAt: new Date(),
      userId: input.userId,
      role: input.role,
    },
    create: { ...input, expiresAt: new Date(Date.now() + PRESENCE_LEASE_MS) },
  });
  const active = await prisma.sessionPresenceLease.groupBy({
    by: ['role'],
    where: { sessionId: input.sessionId, expiresAt: { gt: new Date() } },
    _count: true,
  });
  const clientPresent = active.some((item) => item.role === 'CLIENT' && item._count > 0);
  const consultantPresent = active.some((item) => item.role === 'CONSULTANT' && item._count > 0);
  const session = await prisma.applicationSession.findUniqueOrThrow({
    where: { id: input.sessionId },
  });
  if (session.status !== 'ENDED' && session.status !== 'PAUSED') {
    const status =
      clientPresent && consultantPresent
        ? 'LIVE'
        : clientPresent
          ? 'WAITING_FOR_CONSULTANT'
          : 'WAITING_FOR_CLIENT';
    if (status !== session.status)
      await prisma.applicationSession.update({
        where: { id: session.id },
        data: { status, version: { increment: 1 } },
      });
  }
  return {
    leaseId: lease.id,
    clientPresent,
    consultantPresent,
    supervisionSafe: clientPresent && consultantPresent,
  };
}

export async function sessionSnapshot(prisma: PrismaClient, sessionId: string) {
  const session = await prisma.applicationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('SESSION_NOT_FOUND', 404, 'Live session was not found');
  const now = new Date();
  const [messages, active] = await Promise.all([
    prisma.sessionMessage.findMany({
      where: { sessionId },
      select: { id: true, authorRole: true, body: true, createdAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
    }),
    prisma.sessionPresenceLease.groupBy({
      by: ['role'],
      where: { sessionId, expiresAt: { gt: now } },
      _count: true,
    }),
  ]);
  const clientPresent = active.some((item) => item.role === 'CLIENT' && item._count > 0);
  const consultantPresent = active.some((item) => item.role === 'CONSULTANT' && item._count > 0);
  return {
    session: {
      id: session.id,
      roundId: session.roundId,
      appointmentId: session.appointmentId,
      strategyVersionId: session.strategyVersionId,
      status: session.status,
      pauseReason: session.pauseReason,
      version: session.version,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
    presence: {
      clientPresent,
      consultantPresent,
      supervisionSafe: clientPresent && consultantPresent,
    },
    messages,
  };
}

export async function sendSessionMessage(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    clientId: string;
    actorId: string;
    role: SessionParticipantRole;
    body: string;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'session',
      subjectId: input.sessionId,
      operation: 'session.message',
      key: input.idempotencyKey,
      requestHash: digest({ body: input.body }),
    },
    audit: (result) => ({
      action: 'SESSION_MESSAGE_SENT',
      entityType: 'SessionMessage',
      entityId: String((result as { id: string }).id),
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'session.message',
      eventKey: `session:${input.sessionId}:message:${input.idempotencyKey}`,
      aggregateType: 'ApplicationSession',
      aggregateId: input.sessionId,
      payload: (result) => ({
        clientId: input.clientId,
        domains: ['live-session'],
        sessionId: input.sessionId,
        messageId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const message = await tx.sessionMessage.create({
        data: {
          sessionId: input.sessionId,
          clientId: input.clientId,
          authorUserId: input.actorId,
          authorRole: input.role,
          body: input.body,
        },
      });
      return {
        id: message.id,
        createdAt: message.createdAt.toISOString(),
      } as Prisma.InputJsonObject;
    },
  });
}
