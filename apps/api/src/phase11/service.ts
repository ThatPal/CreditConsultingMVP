import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

export type Phase11ClientView = Awaited<ReturnType<typeof getPhase11ClientView>>;

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function seasonalPeriod(at = new Date()) {
  const month = at.getUTCMonth() + 1;
  const season = month <= 2 || month === 12 ? 'Winter' : month <= 5 ? 'Spring' : month <= 8 ? 'Summer' : 'Fall';
  return { season, year: at.getUTCFullYear(), displayName: `${season} ${at.getUTCFullYear()}` };
}

async function authoritativeContext(prisma: PrismaClient | Prisma.TransactionClient, clientId: string) {
  const [goal, profile, plan, cards, recentApplication, majorContext] = await Promise.all([
    prisma.clientGoal.findFirst({ where: { clientId, status: 'ACTIVE', priority: 'PRIMARY' }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
    prisma.creditProfileState.findUnique({ where: { clientId } }),
    prisma.plan.findFirst({
      where: { clientId, status: { in: ['ACTIVE', 'APPROVED'] }, purpose: { in: ['PREPARATION', 'NURTURE'] } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      include: { versions: { where: { status: { in: ['ACTIVE', 'APPROVED'] } }, orderBy: { version: 'desc' }, take: 1, include: { items: true } } },
    }),
    prisma.clientCard.aggregate({ where: { clientId }, _count: true, _max: { updatedAt: true } }),
    prisma.cycleApplication.findFirst({ where: { cycle: { clientId } }, orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }] }),
    prisma.workItem.findFirst({ where: { clientId, domain: 'MAJOR_READINESS', status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
  ]);
  const planVersion = plan?.versions[0] ?? null;
  const context = {
    goalId: goal?.id ?? null,
    goalVersion: goal?.version ?? null,
    profileStateId: profile?.id ?? null,
    profileStatus: profile?.status ?? 'NOT_AVAILABLE',
    sourceReviewId: profile?.sourceReviewId ?? null,
    planVersionId: planVersion?.id ?? null,
    planFingerprint: planVersion?.sourceFingerprint ?? null,
    cardCount: cards._count,
    cardsUpdatedAt: cards._max.updatedAt?.toISOString() ?? null,
    recentApplicationId: recentApplication?.id ?? null,
    majorContextId: majorContext?.id ?? null,
  };
  return { goal, profile, plan, planVersion, majorContext, context, fingerprint: hash(context) };
}

function assertCurrentProfile(context: Awaited<ReturnType<typeof authoritativeContext>>) {
  if (!context.goal) throw new AppError('PRIMARY_GOAL_REQUIRED', 409, 'Confirm a primary goal before starting a seasonal cycle');
  if (!context.profile || context.profile.status !== 'CURRENT' || !context.profile.sourceReviewId)
    throw new AppError('CURRENT_REVIEW_REQUIRED', 409, 'A current published Credit Profile Review is required before continuing');
}

export async function startOrResumeCycle(prisma: PrismaClient, input: { clientId: string; actorId: string; idempotencyKey: string }) {
  return executeConsequentialCommand<{ cycleId: string; displayName: string; resumed: boolean; existing: boolean }>(prisma, {
    idempotency: { scope: 'phase11-cycle', subjectId: input.clientId, operation: 'start-or-resume', key: input.idempotencyKey },
    audit: (result) => ({ action: result.resumed ? 'CREDIT_CYCLE_RESUMED' : result.existing ? 'CREDIT_CYCLE_START_REPLAYED' : 'CREDIT_CYCLE_STARTED', entityType: 'ApplicationCycle', entityId: result.cycleId, clientId: input.clientId, actorId: input.actorId, metadata: { seasonalLabel: result.displayName } }),
    outbox: { eventType: 'credit-cycle.changed', eventKey: `credit-cycle:${input.clientId}:${input.idempotencyKey}`, aggregateType: 'ApplicationCycle', aggregateId: (result) => result.cycleId, payload: (result) => ({ clientId: input.clientId, cycleId: result.cycleId, resumed: result.resumed }) },
    mutate: async (tx) => {
      const source = await authoritativeContext(tx, input.clientId);
      assertCurrentProfile(source);
      const current = await tx.applicationCycle.findFirst({ where: { clientId: input.clientId, status: { in: ['ACTIVE', 'PAUSED'] } }, include: { goalSnapshot: true }, orderBy: [{ startedAt: 'desc' }, { id: 'asc' }] });
      if (current?.status === 'ACTIVE') return { cycleId: current.id, displayName: current.displayName ?? `Cycle ${current.cycleNumber}`, resumed: false, existing: true };
      if (current) {
        if (!current.goalSnapshot || current.goalSnapshot.sourceGoalId !== source.goal!.id || current.goalSnapshot.sourceGoalVersion !== source.goal!.version)
          throw new AppError('CYCLE_GOAL_RECONFIRMATION_REQUIRED', 409, 'Your goal changed while this cycle was paused. Start a new seasonal cycle after confirming the current goal');
        const resumed = await tx.applicationCycle.update({ where: { id: current.id }, data: { status: 'ACTIVE', pausedAt: null, resumedAt: new Date() } });
        return { cycleId: resumed.id, displayName: resumed.displayName ?? `Cycle ${resumed.cycleNumber}`, resumed: true, existing: false };
      }
      const latest = await tx.applicationCycle.findFirst({ where: { clientId: input.clientId }, orderBy: { cycleNumber: 'desc' }, select: { cycleNumber: true } });
      const journey = await tx.creditJourney.upsert({ where: { clientId: input.clientId }, create: { clientId: input.clientId }, update: { status: 'ACTIVE', completedAt: null } });
      const period = seasonalPeriod();
      const created = await tx.applicationCycle.create({
        data: {
          clientId: input.clientId, journeyId: journey.id, cycleNumber: (latest?.cycleNumber ?? 0) + 1,
          season: period.season, year: period.year, displayName: period.displayName, goalConfirmedAt: new Date(),
          goalSnapshot: { create: { sourceGoalId: source.goal!.id, sourceGoalVersion: source.goal!.version, goalType: source.goal!.goalType, scope: source.goal!.scope, targetAmount: source.goal!.targetAmount, allowAnnualFee: source.goal!.allowAnnualFee, cardTypePreference: source.goal!.cardTypePreference, offerPreferences: source.goal!.offerPreferences, feePreference: source.goal!.feePreference, preferenceNote: source.goal!.preferenceNote } },
        },
      });
      await tx.nurturePeriod.updateMany({ where: { clientId: input.clientId, status: 'ACTIVE' }, data: { status: 'COMPLETE', endedAt: new Date() } });
      return { cycleId: created.id, displayName: created.displayName!, resumed: false, existing: false };
    },
  });
}

export async function pauseCycle(prisma: PrismaClient, input: { clientId: string; actorId: string; cycleId: string; idempotencyKey: string }) {
  return executeConsequentialCommand<{ cycleId: string; status: 'PAUSED' }>(prisma, {
    idempotency: { scope: 'phase11-cycle', subjectId: input.clientId, operation: `pause:${input.cycleId}`, key: input.idempotencyKey },
    audit: { action: 'CREDIT_CYCLE_PAUSED', entityType: 'ApplicationCycle', entityId: input.cycleId, clientId: input.clientId, actorId: input.actorId },
    outbox: { eventType: 'credit-cycle.changed', eventKey: `credit-cycle:${input.cycleId}:paused`, aggregateType: 'ApplicationCycle', aggregateId: input.cycleId, payload: { clientId: input.clientId, cycleId: input.cycleId, status: 'PAUSED' } },
    mutate: async (tx) => {
      const cycle = await tx.applicationCycle.findFirst({ where: { id: input.cycleId, clientId: input.clientId, status: 'ACTIVE' } });
      if (!cycle) throw new AppError('CYCLE_NOT_ACTIVE', 409, 'The seasonal cycle is not active');
      await tx.applicationCycle.update({ where: { id: cycle.id }, data: { status: 'PAUSED', pausedAt: new Date() } });
      return { cycleId: cycle.id, status: 'PAUSED' as const };
    },
  });
}

async function roundProjection(prisma: PrismaClient, roundId: string, clientId: string) {
  const round = await prisma.creditCardRound.findFirst({
    where: { id: roundId, clientId },
    include: { cycle: true, goalSnapshot: true, serviceEntitlement: true, preparationPlanVersion: { include: { items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } } }, majorApplicationChecks: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
  const current = await authoritativeContext(prisma, clientId);
  const requiredItems = round.preparationPlanVersion?.items.filter((item) => item.required) ?? [];
  const preparationComplete = requiredItems.every((item) => item.status === 'COMPLETED');
  const profileCurrent = current.profile?.status === 'CURRENT' && current.profile.id === round.profileStateId;
  const goalCurrent = current.goal?.id === round.goalSnapshot.sourceGoalId && current.goal.version === round.goalSnapshot.sourceGoalVersion;
  const captured = round.sourceContext as Record<string, unknown>;
  const sourceCurrent = ['planVersionId', 'planFingerprint', 'cardCount', 'cardsUpdatedAt', 'recentApplicationId'].every((key) => (current.context as Record<string, unknown>)[key] === captured[key]);
  const majorCheck = round.majorApplicationChecks[0] ?? null;
  const blockers = [!profileCurrent && 'CURRENT_REVIEW_REQUIRED', !goalCurrent && 'GOAL_CHANGED', !sourceCurrent && 'SOURCE_CONTEXT_CHANGED', !preparationComplete && 'PREPARATION_INCOMPLETE', !majorCheck && 'MAJOR_CHECK_REQUIRED'].filter(Boolean) as string[];
  const coordinationRequired = majorCheck ? majorCheck.choice !== 'NO' : false;
  const strategyReady = blockers.length === 0;
  return {
    round: { ...round, sourceContext: round.sourceContext, majorApplicationChecks: undefined },
    readiness: { entitlement: round.serviceEntitlement.status, profileCurrent, goalCurrent, sourceCurrent, preparationComplete, majorCheckComplete: Boolean(majorCheck), coordinationRequired, strategyReady, strategyStatus: 'NOT_STARTED', blockers },
    majorCheck,
    primaryAction: !profileCurrent ? { label: 'Start a new Credit Profile Review', path: '/app/credit-center/review' } : !preparationComplete ? { label: 'Complete preparation', path: '/app/plan' } : !majorCheck ? { label: 'Answer major application check', path: `/app/rounds/${round.id}/major-check` } : { label: 'Wait for consultant strategy', path: `/app/rounds/${round.id}` },
  };
}

export async function createRound(prisma: PrismaClient, input: { clientId: string; actorId: string; cycleId: string; idempotencyKey: string; failAfterEntitlement?: boolean }) {
  const result = await executeConsequentialCommand<{ roundId: string; entitlementId: string }>(prisma, {
    idempotency: { scope: 'phase11-round', subjectId: input.clientId, operation: `create:${input.cycleId}`, key: input.idempotencyKey },
    audit: (value) => ({ action: 'CREDIT_CARD_ROUND_STARTED', entityType: 'CreditCardRound', entityId: value.roundId, clientId: input.clientId, actorId: input.actorId, metadata: { cycleId: input.cycleId, entitlementId: value.entitlementId } }),
    outbox: { eventType: 'credit-card-round.changed', eventKey: `credit-card-round:${input.cycleId}`, aggregateType: 'CreditCardRound', aggregateId: (value) => value.roundId, payload: (value) => ({ clientId: input.clientId, cycleId: input.cycleId, roundId: value.roundId }) },
    mutate: async (tx) => {
      const existing = await tx.creditCardRound.findUnique({ where: { cycleId_clientId: { cycleId: input.cycleId, clientId: input.clientId } } });
      if (existing) return { roundId: existing.id, entitlementId: existing.serviceEntitlementId };
      const source = await authoritativeContext(tx, input.clientId);
      assertCurrentProfile(source);
      const cycle = await tx.applicationCycle.findFirst({ where: { id: input.cycleId, clientId: input.clientId, status: 'ACTIVE' }, include: { goalSnapshot: true } });
      if (!cycle?.goalSnapshot) throw new AppError('CYCLE_NOT_READY', 409, 'Confirm the current seasonal cycle goal before starting a round');
      if (cycle.goalSnapshot.sourceGoalId !== source.goal!.id || cycle.goalSnapshot.sourceGoalVersion !== source.goal!.version)
        throw new AppError('CYCLE_GOAL_STALE', 409, 'The current goal changed after this cycle was confirmed');
      const entitlements = await tx.serviceEntitlement.findMany({ where: { clientId: input.clientId, serviceType: 'CREDIT_CARD_ROUND', status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }] });
      const entitlement = entitlements.find((candidate) => candidate.quantityUsed < candidate.quantityGranted);
      if (!entitlement) throw new AppError('ROUND_ENTITLEMENT_REQUIRED', 409, 'Purchase the Credit Card Round service before continuing');
      const finalUse = entitlement.quantityUsed + 1 >= entitlement.quantityGranted;
      const claimed = await tx.serviceEntitlement.updateMany({ where: { id: entitlement.id, status: 'ACTIVE', quantityUsed: entitlement.quantityUsed }, data: { status: finalUse ? 'CONSUMED' : 'ACTIVE', quantityUsed: { increment: 1 }, ...(finalUse ? { consumedAt: new Date() } : {}) } });
      if (claimed.count !== 1) throw new AppError('ROUND_ENTITLEMENT_ALREADY_USED', 409, 'This round entitlement is already in use');
      if (input.failAfterEntitlement) throw new Error('PHASE11_FAILURE_INJECTION');
      const created = await tx.creditCardRound.create({ data: { clientId: input.clientId, cycleId: cycle.id, goalSnapshotId: cycle.goalSnapshot.id, profileStateId: source.profile!.id, sourceReviewId: source.profile!.sourceReviewId, preparationPlanVersionId: source.planVersion?.id ?? null, serviceEntitlementId: entitlement.id, sourceFingerprint: source.fingerprint, sourceContext: source.context as Prisma.InputJsonValue } });
      return { roundId: created.id, entitlementId: entitlement.id };
    },
  });
  return { ...result, view: await roundProjection(prisma, result.result.roundId, input.clientId) };
}

export async function getRoundClientView(prisma: PrismaClient, roundId: string, clientId: string) {
  return roundProjection(prisma, roundId, clientId);
}

export async function submitMajorApplicationCheck(prisma: PrismaClient, input: { clientId: string; actorId: string; roundId: string; choice: 'NO' | 'MORTGAGE' | 'AUTO' | 'STUDENT' | 'OTHER_MAJOR_FINANCING' | 'NOT_SURE'; intendedTiming?: string | null; clientContext?: string | null; idempotencyKey: string }) {
  const requestFingerprint = hash({ choice: input.choice, intendedTiming: input.intendedTiming ?? null, clientContext: input.clientContext ?? null });
  const result = await executeConsequentialCommand<{ checkId: string; version: number }>(prisma, {
    idempotency: { scope: 'phase11-major-check', subjectId: input.clientId, operation: `submit:${input.roundId}`, key: input.idempotencyKey, requestHash: requestFingerprint },
    audit: (value) => ({ action: 'ROUND_MAJOR_APPLICATION_CHECK_SUBMITTED', entityType: 'RoundMajorApplicationCheck', entityId: value.checkId, clientId: input.clientId, actorId: input.actorId, metadata: { roundId: input.roundId, choice: input.choice, version: value.version } }),
    outbox: { eventType: 'round-major-application-check.changed', eventKey: `round-major-check:${input.roundId}:${input.idempotencyKey}`, aggregateType: 'CreditCardRound', aggregateId: input.roundId, payload: (value) => ({ clientId: input.clientId, roundId: input.roundId, checkId: value.checkId, coordinationRequired: input.choice !== 'NO' }) },
    mutate: async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`phase11-major:${input.roundId}`})) IS NULL AS acquired`);
      const round = await tx.creditCardRound.findFirst({ where: { id: input.roundId, clientId: input.clientId, status: { in: ['PREPARATION', 'READY_FOR_STRATEGY', 'BLOCKED'] } } });
      if (!round) throw new AppError('ROUND_NOT_FOUND', 404, 'Credit card round was not found');
      const latest = await tx.roundMajorApplicationCheck.findFirst({ where: { roundId: round.id }, orderBy: { version: 'desc' } });
      const source = await authoritativeContext(tx, input.clientId);
      const check = await tx.roundMajorApplicationCheck.create({ data: { roundId: round.id, clientId: input.clientId, version: (latest?.version ?? 0) + 1, choice: input.choice, intendedTiming: input.choice === 'NO' ? null : (input.intendedTiming ?? null), clientContext: input.choice === 'NO' ? null : (input.clientContext ?? null), sourceMajorContextId: source.majorContext?.id ?? null, submittedByUserId: input.actorId, sourceFingerprint: requestFingerprint } });
      if (input.choice !== 'NO' && !source.majorContext) await tx.workItem.create({ data: { clientId: input.clientId, title: 'Coordinate upcoming major credit with card round', domain: 'MAJOR_READINESS', priority: 'HIGH', suggestedNextAction: 'Review client timing before preparing card strategy', sourceType: 'CreditCardRound', sourceId: round.id, dedupeKey: `round-major:${round.id}`, reasonCode: 'CLIENT_MAJOR_APPLICATION_DISCLOSED', deepLink: { path: `/crm/clients/${input.clientId}` } } });
      return { checkId: check.id, version: check.version };
    },
  });
  return { ...result, view: await roundProjection(prisma, input.roundId, input.clientId) };
}

export async function getPhase11ClientView(prisma: PrismaClient, clientId: string) {
  const source = await authoritativeContext(prisma, clientId);
  const cycle = await prisma.applicationCycle.findFirst({ where: { clientId, status: { in: ['ACTIVE', 'PAUSED'] } }, include: { goalSnapshot: true, creditCardRounds: { orderBy: { startedAt: 'desc' }, take: 1 } }, orderBy: [{ startedAt: 'desc' }, { id: 'asc' }] });
  const blockers = [!source.goal && 'PRIMARY_GOAL_REQUIRED', source.profile?.status !== 'CURRENT' && 'CURRENT_REVIEW_REQUIRED'].filter(Boolean) as string[];
  return { cycle, currentGoal: source.goal, profileState: source.profile, blockers, canStartOrResume: blockers.length === 0, currentRoundId: cycle?.creditCardRounds[0]?.id ?? null };
}
