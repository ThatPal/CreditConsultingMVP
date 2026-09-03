import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

export interface CalendarProvider {
  readonly configured: boolean;
  busy(
    consultantId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ startsAt: Date; endsAt: Date }>>;
  mirror(_appointmentId: string): Promise<{ externalReference?: string }>;
}

export const noOpCalendarProvider: CalendarProvider = {
  configured: false,
  async busy() {
    return [];
  },
  async mirror() {
    return {};
  },
};

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const overlaps = (a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

function offsetAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return (
    Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) -
    date.getTime()
  );
}

export function localSlotUtc(day: Date, minute: number, timezone: string) {
  const guess = new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      Math.floor(minute / 60),
      minute % 60,
    ),
  );
  let result = new Date(guess.getTime() - offsetAt(guess, timezone));
  result = new Date(guess.getTime() - offsetAt(result, timezone));
  return result;
}

export async function availableSlots(
  prisma: PrismaClient,
  input: { roundId: string; clientId: string; from?: Date; days?: number },
  provider: CalendarProvider = noOpCalendarProvider,
) {
  const round = await prisma.creditCardRound.findFirst({
    where: { id: input.roundId, clientId: input.clientId },
    include: { strategy: { include: { approvedVersion: true } } },
  });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Round was not found');
  if (!round.strategy?.approvedVersion || round.strategy.status !== 'APPROVED')
    throw new AppError(
      'STRATEGY_NOT_APPROVED',
      409,
      'An approved current Strategy is required before scheduling',
    );
  const assignment = await prisma.staffClientAssignment.findFirst({
    where: { clientId: input.clientId, deactivatedAt: null },
    orderBy: [{ activatedAt: 'asc' }, { id: 'asc' }],
  });
  if (!assignment)
    return {
      eligible: false,
      blockers: ['CONSULTANT_NOT_ASSIGNED'],
      timezone: 'UTC',
      providerDegraded: !provider.configured,
      slots: [],
    };
  const rules = await prisma.consultantAvailabilityRule.findMany({
    where: { consultantId: assignment.staffUserId, active: true },
    orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }, { id: 'asc' }],
  });
  const from = input.from ?? new Date();
  const to = new Date(from.getTime() + (input.days ?? 21) * 86_400_000);
  const [exceptions, appointments, externalBusy] = await Promise.all([
    prisma.consultantAvailabilityException.findMany({
      where: { consultantId: assignment.staffUserId, startsAt: { lt: to }, endsAt: { gt: from } },
    }),
    prisma.appointment.findMany({
      where: {
        consultantId: assignment.staffUserId,
        status: 'BOOKED',
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    }),
    provider.busy(assignment.staffUserId, from, to).catch(() => []),
  ]);
  const timezone = rules[0]?.timezone ?? 'America/New_York';
  const slots: Array<{
    startsAt: string;
    endsAt: string;
    timezone: string;
    durationMinutes: number;
  }> = [];
  for (let d = 0; d < (input.days ?? 21); d += 1) {
    const day = new Date(from.getTime() + d * 86_400_000);
    for (const rule of rules.filter((item) => item.weekday === day.getUTCDay())) {
      for (let minute = rule.startMinute; minute + 45 <= rule.endMinute; minute += 45) {
        const startsAt = localSlotUtc(day, minute, rule.timezone);
        const endsAt = new Date(startsAt.getTime() + 45 * 60_000);
        const slot = { startsAt, endsAt };
        if (
          startsAt <= from ||
          [...exceptions.filter((e) => !e.available), ...appointments, ...externalBusy].some(
            (busy) => overlaps(slot, busy),
          )
        )
          continue;
        slots.push({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          timezone: rule.timezone,
          durationMinutes: 45,
        });
      }
    }
  }
  return {
    eligible: true,
    blockers: [],
    timezone,
    providerDegraded: !provider.configured,
    consultantId: assignment.staffUserId,
    strategyVersionId: round.strategy.approvedVersion.id,
    slots: slots.slice(0, 80),
  };
}

export async function currentAppointment(prisma: PrismaClient, roundId: string, clientId: string) {
  return prisma.appointment.findFirst({
    where: { roundId, clientId, status: 'BOOKED' },
    select: {
      id: true,
      roundId: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      status: true,
      externalSyncStatus: true,
      updatedAt: true,
    },
  });
}

export async function bookAppointment(
  prisma: PrismaClient,
  input: {
    roundId: string;
    clientId: string;
    actorId: string;
    startsAt: Date;
    timezone: string;
    idempotencyKey: string;
  },
  provider: CalendarProvider = noOpCalendarProvider,
) {
  const slots = await availableSlots(
    prisma,
    {
      roundId: input.roundId,
      clientId: input.clientId,
      from: new Date(input.startsAt.getTime() - 1000),
      days: 2,
    },
    provider,
  );
  const chosen = slots.slots.find((slot) => slot.startsAt === input.startsAt.toISOString());
  if (!chosen || !slots.consultantId || !slots.strategyVersionId)
    throw new AppError(
      'APPOINTMENT_SLOT_STALE',
      409,
      'That appointment time is no longer available',
    );
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'client',
      subjectId: input.clientId,
      operation: 'appointment.book',
      key: input.idempotencyKey,
      requestHash: hash({
        roundId: input.roundId,
        startsAt: input.startsAt,
        timezone: input.timezone,
      }),
    },
    audit: (r) => ({
      action: 'APPOINTMENT_BOOKED',
      entityType: 'Appointment',
      entityId: String((r as { id: string }).id),
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'appointment.updated',
      eventKey: `appointment:${input.roundId}:book:${input.idempotencyKey}`,
      aggregateType: 'Appointment',
      aggregateId: (r) => String((r as { id: string }).id),
      payload: (r) => ({
        clientId: input.clientId,
        domains: ['appointments'],
        appointmentId: (r as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const conflict = await tx.appointment.findFirst({
        where: {
          consultantId: slots.consultantId,
          status: 'BOOKED',
          startsAt: { lt: new Date(chosen.endsAt) },
          endsAt: { gt: input.startsAt },
        },
      });
      if (conflict)
        throw new AppError(
          'APPOINTMENT_SLOT_STALE',
          409,
          'That appointment time is no longer available',
        );
      const appointment = await tx.appointment.create({
        data: {
          clientId: input.clientId,
          consultantId: slots.consultantId,
          roundId: input.roundId,
          strategyVersionId: slots.strategyVersionId,
          startsAt: input.startsAt,
          endsAt: new Date(chosen.endsAt),
          timezone: input.timezone,
          externalSyncStatus: provider.configured ? 'PENDING' : 'NOT_CONFIGURED',
        },
      });
      return {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      } as Prisma.InputJsonObject;
    },
  });
}

export async function cancelAppointment(
  prisma: PrismaClient,
  input: {
    appointmentId: string;
    clientId: string;
    actorId: string;
    reason: string;
    idempotencyKey: string;
  },
) {
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'client',
      subjectId: input.clientId,
      operation: 'appointment.cancel',
      key: input.idempotencyKey,
      requestHash: hash({ appointmentId: input.appointmentId, reason: input.reason }),
    },
    audit: {
      action: 'APPOINTMENT_CANCELLED',
      entityType: 'Appointment',
      entityId: input.appointmentId,
      clientId: input.clientId,
      actorId: input.actorId,
    },
    outbox: {
      eventType: 'appointment.updated',
      eventKey: `appointment:${input.appointmentId}:cancel:${input.idempotencyKey}`,
      aggregateType: 'Appointment',
      aggregateId: input.appointmentId,
      payload: {
        clientId: input.clientId,
        domains: ['appointments'],
        appointmentId: input.appointmentId,
      },
    },
    mutate: async (tx) => {
      const current = await tx.appointment.findFirst({
        where: { id: input.appointmentId, clientId: input.clientId },
      });
      if (!current) throw new AppError('APPOINTMENT_NOT_FOUND', 404, 'Appointment was not found');
      if (current.status === 'CANCELLED')
        return { id: current.id, status: current.status } as Prisma.InputJsonObject;
      const appointment = await tx.appointment.update({
        where: { id: current.id },
        data: { status: 'CANCELLED', cancellationReason: input.reason },
      });
      return { id: appointment.id, status: appointment.status } as Prisma.InputJsonObject;
    },
  });
}

export async function rescheduleAppointment(
  prisma: PrismaClient,
  input: {
    appointmentId: string;
    clientId: string;
    actorId: string;
    startsAt: Date;
    timezone: string;
    idempotencyKey: string;
  },
  provider: CalendarProvider = noOpCalendarProvider,
) {
  const previous = await prisma.appointment.findFirst({
    where: { id: input.appointmentId, clientId: input.clientId, status: 'BOOKED' },
  });
  if (!previous)
    throw new AppError('APPOINTMENT_NOT_FOUND', 404, 'Booked appointment was not found');
  const slots = await availableSlots(
    prisma,
    {
      roundId: previous.roundId,
      clientId: input.clientId,
      from: new Date(input.startsAt.getTime() - 1000),
      days: 2,
    },
    provider,
  );
  const chosen = slots.slots.find((slot) => slot.startsAt === input.startsAt.toISOString());
  if (!chosen || !slots.consultantId || !slots.strategyVersionId)
    throw new AppError(
      'APPOINTMENT_SLOT_STALE',
      409,
      'That appointment time is no longer available',
    );
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'client',
      subjectId: input.clientId,
      operation: 'appointment.reschedule',
      key: input.idempotencyKey,
      requestHash: hash({
        appointmentId: input.appointmentId,
        startsAt: input.startsAt,
        timezone: input.timezone,
      }),
    },
    audit: (result) => ({
      action: 'APPOINTMENT_RESCHEDULED',
      entityType: 'Appointment',
      entityId: String((result as { id: string }).id),
      clientId: input.clientId,
      actorId: input.actorId,
      metadata: { rescheduledFromId: input.appointmentId },
    }),
    outbox: {
      eventType: 'appointment.updated',
      eventKey: `appointment:${input.appointmentId}:reschedule:${input.idempotencyKey}`,
      aggregateType: 'Appointment',
      aggregateId: (result) => String((result as { id: string }).id),
      payload: (result) => ({
        clientId: input.clientId,
        domains: ['appointments'],
        appointmentId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const current = await tx.appointment.findFirst({
        where: { id: input.appointmentId, clientId: input.clientId, status: 'BOOKED' },
      });
      if (!current)
        throw new AppError('APPOINTMENT_STALE', 409, 'The appointment has already changed');
      await tx.appointment.update({
        where: { id: current.id },
        data: { status: 'CANCELLED', cancellationReason: 'Rescheduled' },
      });
      const conflict = await tx.appointment.findFirst({
        where: {
          consultantId: slots.consultantId,
          status: 'BOOKED',
          startsAt: { lt: new Date(chosen.endsAt) },
          endsAt: { gt: input.startsAt },
        },
      });
      if (conflict)
        throw new AppError(
          'APPOINTMENT_SLOT_STALE',
          409,
          'That appointment time is no longer available',
        );
      const appointment = await tx.appointment.create({
        data: {
          clientId: input.clientId,
          consultantId: slots.consultantId,
          roundId: current.roundId,
          strategyVersionId: slots.strategyVersionId,
          startsAt: input.startsAt,
          endsAt: new Date(chosen.endsAt),
          timezone: input.timezone,
          externalSyncStatus: provider.configured ? 'PENDING' : 'NOT_CONFIGURED',
          rescheduledFromId: current.id,
        },
      });
      return {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      } as Prisma.InputJsonObject;
    },
  });
}
