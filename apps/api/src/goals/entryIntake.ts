import { createHash } from 'node:crypto';
import type {
  EntryGoalValues,
  IntakeLocator,
  IntakePreview,
  IntakeResolve,
  GoalResolutionReference,
} from '@credit/shared';
import type {
  Prisma,
  PrismaClient,
  ClientGoal,
  AnonymousGoalIntake,
  GoalIntakeResolution,
} from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { appendRevision, lockGoalCollection, advanceGoalCollection } from './prismaGoalStore.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const unavailable = () =>
  new AppError('INTAKE_UNAVAILABLE', 404, 'This saved goal is unavailable for this account');
type Subject = { clientId: string; actorId: string };
type Db = PrismaClient | Prisma.TransactionClient;

export function goalValues(goal: ClientGoal | AnonymousGoalIntake): EntryGoalValues {
  return {
    goalType: goal.goalType,
    scope: goal.scope,
    targetAmount: goal.targetAmount?.toNumber() ?? null,
    allowAnnualFee: goal.allowAnnualFee,
    cardTypePreference: goal.cardTypePreference,
    offerPreferences: [...goal.offerPreferences].sort(),
    feePreference: goal.feePreference,
    preferenceNote: goal.preferenceNote,
  };
}
function resolutionReference(row: GoalIntakeResolution): GoalResolutionReference {
  return {
    id: row.id,
    intakeId: row.intakeId,
    decision: row.decision,
    effect: row.effect,
    goalId: row.goalId,
    goalVersion: row.goalVersion,
    goalRevisionId: row.goalRevisionId,
    resolvedAt: row.resolvedAt.toISOString(),
  };
}
export async function requireEntrySubject(db: Db, subject: Subject) {
  const client = await db.client.findFirst({
    where: {
      id: subject.clientId,
      userId: subject.actorId,
      user: { role: 'CLIENT', status: 'ACTIVE', emailVerified: true },
    },
  });
  if (!client)
    throw new AppError(
      'ENTRY_VERIFIED_CLIENT_REQUIRED',
      403,
      'Sign in with a verified client account to continue',
    );
  return client;
}
async function locate(db: Db, locator: IntakeLocator, subject: Subject) {
  let tokenHash: string;
  if (locator.kind === 'CLAIM') {
    const claim = await db.goalIntakeRegistrationClaim.findFirst({
      where: {
        id: locator.id,
        attachedClientId: subject.clientId,
        attachedUserId: subject.actorId,
      },
    });
    if (!claim) throw unavailable();
    tokenHash = claim.intakeTokenHash;
  } else tokenHash = hash(locator.value);
  const intake = await db.anonymousGoalIntake.findUnique({
    where: { tokenHash },
    include: { resolution: true },
  });
  if (!intake) throw unavailable();
  const foreign = await db.goalIntakeRegistrationClaim.findFirst({
    where: { intakeTokenHash: tokenHash, attachedClientId: { not: subject.clientId } },
  });
  if (foreign || (intake.consumedByClientId && intake.consumedByClientId !== subject.clientId))
    throw unavailable();
  return intake;
}
function assertActive(intake: AnonymousGoalIntake & { resolution: GoalIntakeResolution | null }) {
  if (intake.consumedAt)
    throw new AppError(
      intake.resolution ? 'INTAKE_ALREADY_RESOLVED' : 'LEGACY_RESOLUTION_UNAVAILABLE',
      409,
      intake.resolution
        ? 'This saved goal already has a recorded decision'
        : 'The earlier result is unavailable. Open your current Goals.',
    );
  if (intake.expiresAt <= new Date())
    throw new AppError('INTAKE_EXPIRED', 410, 'This saved goal has expired');
}
async function snapshot(
  db: Db,
  intake: AnonymousGoalIntake & { resolution: GoalIntakeResolution | null },
  subject: Subject,
): Promise<IntakePreview> {
  const client = await requireEntrySubject(db, subject);
  const current = await db.clientGoal.findFirst({
    where: { clientId: subject.clientId, priority: 'PRIMARY', status: 'ACTIVE' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  const collision = await db.clientGoal.findFirst({
    where: {
      clientId: subject.clientId,
      goalType: intake.goalType,
      scope: intake.scope,
      ...(current ? { id: { not: current.id } } : {}),
    },
  });
  const savedGoal = goalValues(intake);
  const currentGoal = current
    ? { id: current.id, version: current.version, ...goalValues(current) }
    : null;
  const differences = (Object.keys(savedGoal) as (keyof EntryGoalValues)[])
    .filter(
      (field) =>
        !currentGoal || JSON.stringify(savedGoal[field]) !== JSON.stringify(currentGoal[field]),
    )
    .map((field) => ({ field, before: currentGoal?.[field] ?? null, after: savedGoal[field] }));
  const state =
    collision || (current && current.goalType !== 'TOTAL_AVAILABLE_CREDIT')
      ? 'TARGET_CONFLICT'
      : !current
        ? 'NO_PRIMARY'
        : differences.length
          ? 'DIFFERENT'
          : 'MATCHING';
  return {
    schemaVersion: 1,
    ...subject,
    intakeId: intake.id,
    intakeVersion: intake.version,
    expiresAt: intake.expiresAt.toISOString(),
    goalSetVersion: client.goalSetVersion,
    savedGoal,
    currentGoal,
    state,
    differences,
    decisions: [
      {
        decision: 'APPLY_SAVED',
        enabled: state !== 'TARGET_CONFLICT',
        ...(state === 'TARGET_CONFLICT' ? { reasonCode: 'TARGET_CONFLICT' } : {}),
      },
      {
        decision: 'KEEP_CURRENT',
        enabled: !!current,
        ...(!current ? { reasonCode: 'NO_PRIMARY' } : {}),
      },
    ],
    ...(intake.resolution ? { resolution: resolutionReference(intake.resolution) } : {}),
  };
}
export async function previewIntake(
  prisma: PrismaClient,
  locator: IntakeLocator,
  subject: Subject,
) {
  return prisma.$transaction(
    async (tx) => {
      await requireEntrySubject(tx, subject);
      const intake = await locate(tx, locator, subject);
      if (!intake.resolution) assertActive(intake);
      return snapshot(tx, intake, subject);
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
export async function pendingIntakes(prisma: PrismaClient, subject: Subject) {
  await requireEntrySubject(prisma, subject);
  const claims = await prisma.goalIntakeRegistrationClaim.findMany({
    where: {
      attachedClientId: subject.clientId,
      attachedUserId: subject.actorId,
      expiresAt: { gt: new Date() },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const entries = [];
  for (const claim of claims) {
    const intake = await prisma.anonymousGoalIntake.findFirst({
      where: { tokenHash: claim.intakeTokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (intake)
      entries.push({
        claimId: claim.id,
        intakeId: intake.id,
        intakeVersion: intake.version,
        expiresAt: intake.expiresAt.toISOString(),
        goalSummary: goalValues(intake),
      });
  }
  return { entries, count: entries.length, available: entries.length > 0 };
}
export async function resolveIntake(
  prisma: PrismaClient,
  input: IntakeResolve,
  subject: Subject,
  key: string,
) {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid decision key is required');
  await requireEntrySubject(prisma, subject);
  const located = await locate(prisma, input.locator, subject);
  const expectations = {
    decision: input.decision,
    expectedIntakeVersion: input.expectedIntakeVersion,
    expectedGoalSetVersion: input.expectedGoalSetVersion,
    expectedCurrentGoal: input.expectedCurrentGoal,
  };
  const requestHash = hash(JSON.stringify({ intakeId: located.id, ...subject, ...expectations }));
  const command = await executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'ENTRY_GOAL_INTAKE',
      subjectId: subject.clientId,
      operation: `RESOLVE:${located.id}`,
      key,
      requestHash,
    },
    mutate: async (tx) => {
      await lockGoalCollection(tx, subject.clientId);
      await tx.$queryRaw`SELECT id FROM "AnonymousGoalIntake" WHERE id = ${located.id}::uuid FOR UPDATE`;
      const intake = await locate(tx, input.locator, subject);
      assertActive(intake);
      const view = await snapshot(tx, intake, subject);
      const current = view.currentGoal;
      if (
        view.intakeVersion !== input.expectedIntakeVersion ||
        view.goalSetVersion !== input.expectedGoalSetVersion ||
        (current?.id ?? null) !== (input.expectedCurrentGoal?.id ?? null) ||
        (current?.version ?? null) !== (input.expectedCurrentGoal?.version ?? null)
      )
        throw new AppError(
          view.intakeVersion !== input.expectedIntakeVersion
            ? 'STALE_INTAKE'
            : 'STALE_GOAL_CONTEXT',
          409,
          'Your goal or saved intake changed. Review the latest comparison before choosing again.',
        );
      if (!view.decisions.find((d) => d.decision === input.decision)?.enabled)
        throw new AppError(
          'GOAL_TARGET_CONFLICT',
          409,
          'Manage the conflicting Goal before applying this saved goal',
        );
      let effect: GoalResolutionReference['effect'] =
        input.decision === 'KEEP_CURRENT' ? 'KEPT' : 'UNCHANGED';
      let goalId = current?.id;
      let goalVersion = current?.version;
      let goalRevisionId: string | null = null;
      if (input.decision === 'APPLY_SAVED' && view.state !== 'MATCHING') {
        const values = {
          goalType: intake.goalType,
          scope: intake.scope,
          targetAmount: intake.targetAmount,
          allowAnnualFee: intake.allowAnnualFee,
          cardTypePreference: intake.cardTypePreference,
          offerPreferences: intake.offerPreferences,
          feePreference: intake.feePreference,
          preferenceNote: intake.preferenceNote,
        };
        const goal = current
          ? await tx.clientGoal.update({
              where: { id: current.id },
              data: { ...values, version: { increment: 1 } },
            })
          : await tx.clientGoal.create({
              data: { ...values, clientId: subject.clientId, priority: 'PRIMARY' },
            });
        const revision = await appendRevision(tx, goal, subject.actorId, 'ENTRY_GOAL_INTAKE');
        await advanceGoalCollection(tx, subject.clientId);
        effect = current ? 'UPDATED' : 'CREATED';
        goalId = goal.id;
        goalVersion = goal.version;
        goalRevisionId = revision.id;
        await tx.outboxEvent.create({
          data: {
            eventType: 'client.goal.changed',
            eventKey: `entry-goal-changed:${intake.id}`,
            aggregateType: 'ClientGoal',
            aggregateId: goal.id,
            payload: {
              clientId: subject.clientId,
              domains: ['goals'],
              refetch: true,
              reassessmentRequired: true,
            },
          },
        });
      }
      if (!goalId || !goalVersion)
        throw new AppError('GOAL_TARGET_CONFLICT', 409, 'No current goal is available');
      const resolution = await tx.goalIntakeResolution.create({
        data: {
          intakeId: intake.id,
          ...subject,
          decision: input.decision,
          effect,
          expectedIntakeVersion: input.expectedIntakeVersion,
          expectedGoalSetVersion: input.expectedGoalSetVersion,
          expectedGoalId: input.expectedCurrentGoal?.id ?? null,
          expectedGoalVersion: input.expectedCurrentGoal?.version ?? null,
          goalId,
          goalVersion,
          goalRevisionId,
          requestHash,
        },
      });
      await tx.anonymousGoalIntake.update({
        where: { id: intake.id },
        data: { consumedAt: resolution.resolvedAt, consumedByClientId: subject.clientId },
      });
      return resolutionReference(resolution);
    },
    audit: (result) => ({
      actorId: subject.actorId,
      clientId: subject.clientId,
      action: 'GOAL_INTAKE_RESOLVED',
      entityType: 'GoalIntakeResolution',
      entityId: result.id,
      metadata: {
        intakeId: result.intakeId,
        decision: result.decision,
        effect: result.effect,
        goalId: result.goalId,
        goalVersion: result.goalVersion,
      },
    }),
    outbox: {
      eventType: 'goal-intake.resolved',
      eventKey: `goal-intake-resolved:${located.id}`,
      aggregateType: 'GoalIntakeResolution',
      aggregateId: (result) => result.id,
      payload: (result) => ({
        domains: [], // Resolution alone is not a changed credit picture.
        clientId: subject.clientId,
        intakeId: result.intakeId,
        decision: result.decision,
        effect: result.effect,
        goalId: result.goalId,
        goalVersion: result.goalVersion,
      }),
    },
  });
  return { resolution: command.result, replayed: command.replayed };
}
