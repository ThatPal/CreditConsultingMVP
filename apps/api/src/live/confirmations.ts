import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function confirmPreLiveMaterialChanges(
  prisma: PrismaClient,
  input: {
    sessionId: string;
    clientId: string;
    actorId: string;
    noChanges: boolean;
    categories: string[];
  note?: string | undefined;
    expectedSessionVersion: number;
    idempotencyKey: string;
  },
) {
  const session = await prisma.applicationSession.findFirst({
    where: { id: input.sessionId, clientId: input.clientId },
  });
  if (!session) throw new AppError('SESSION_NOT_FOUND', 404, 'Live session was not found');
  if (session.status === 'ENDED')
    throw new AppError('SESSION_ENDED', 409, 'Live session has ended');
  if (input.noChanges && input.categories.length)
    throw new AppError('INVALID_CONFIRMATION', 400, 'No changes cannot include change categories');
  if (!input.noChanges && input.categories.length === 0)
    throw new AppError('CHANGE_CATEGORY_REQUIRED', 400, 'Select at least one changed area');
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'session',
      subjectId: session.id,
      operation: 'prelive.confirm',
      key: input.idempotencyKey,
      requestHash: hash({
        noChanges: input.noChanges,
        categories: input.categories,
        note: input.note,
        expectedSessionVersion: input.expectedSessionVersion,
      }),
    },
    audit: (result) => ({
      action: input.noChanges ? 'PRELIVE_NO_CHANGES_CONFIRMED' : 'PRELIVE_MATERIAL_CHANGE_REPORTED',
      entityType: 'PreLiveMaterialChangeConfirmation',
      entityId: String((result as { id: string }).id),
      clientId: input.clientId,
      actorId: input.actorId,
    }),
    outbox: {
      eventType: 'session.prelive-confirmed',
      eventKey: `session:${session.id}:prelive:${input.idempotencyKey}`,
      aggregateType: 'ApplicationSession',
      aggregateId: session.id,
      payload: (result) => ({
        clientId: input.clientId,
        domains: ['live-session', 'attention'],
        sessionId: session.id,
        confirmationId: (result as { id: string }).id,
      }),
    },
    mutate: async (tx) => {
      const locked = await tx.applicationSession.updateMany({
        where: { id: session.id, version: input.expectedSessionVersion },
        data: { version: { increment: 1 } },
      });
      if (locked.count !== 1)
        throw new AppError(
          'SESSION_VERSION_CONFLICT',
          409,
          'Session changed; review current state and retry',
        );
      await tx.preLiveMaterialChangeConfirmation.updateMany({
        where: { sessionId: session.id, disposition: 'CURRENT' },
        data: { disposition: 'SUPERSEDED', supersededAt: new Date() },
      });
      const latest = await tx.preLiveMaterialChangeConfirmation.aggregate({
        where: { sessionId: session.id },
        _max: { version: true },
      });
      const confirmation = await tx.preLiveMaterialChangeConfirmation.create({
        data: {
          sessionId: session.id,
          clientId: input.clientId,
          roundId: session.roundId,
          strategyVersionId: session.strategyVersionId,
          version: (latest._max.version ?? 0) + 1,
          sourceFingerprint: session.sourceFingerprint,
          submittedByUserId: input.actorId,
          noChanges: input.noChanges,
          reportedDeltas: input.categories,
          note: input.note ?? null,
          disposition: input.noChanges ? 'CURRENT' : 'MATERIAL_CHANGE_REVIEW_REQUIRED',
        },
      });
      if (!input.noChanges)
        await tx.applicationSession.update({
          where: { id: session.id },
          data: { status: 'PAUSED', pauseReason: 'Material change requires Strategy reassessment' },
        });
      return {
        id: confirmation.id,
        version: confirmation.version,
        disposition: confirmation.disposition,
        sessionVersion: input.expectedSessionVersion + 1,
      } as Prisma.InputJsonObject;
    },
  });
}

export async function assertCurrentPreLiveConfirmation(
  prisma: PrismaClient | Prisma.TransactionClient,
  sessionId: string,
) {
  const session = await prisma.applicationSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('SESSION_NOT_FOUND', 404, 'Live session was not found');
  const confirmation = await prisma.preLiveMaterialChangeConfirmation.findFirst({
    where: {
      sessionId,
      strategyVersionId: session.strategyVersionId,
      disposition: 'CURRENT',
      noChanges: true,
    },
    orderBy: [{ version: 'desc' }, { id: 'desc' }],
  });
  if (!confirmation || confirmation.sourceFingerprint !== session.sourceFingerprint)
    throw new AppError(
      'PRELIVE_CONFIRMATION_REQUIRED',
      409,
      'A current no-change confirmation is required',
    );
  const round = await prisma.creditCardRound.findUnique({
    where: { id: session.roundId },
    select: { sourceFingerprint: true },
  });
  if (!round || round.sourceFingerprint !== confirmation.sourceFingerprint)
    throw new AppError(
      'PRELIVE_CONFIRMATION_STALE',
      409,
      'Material state changed after confirmation',
    );
  return confirmation;
}
