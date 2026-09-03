import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import { createPrisma } from '../lib/prisma.js';
import { createPhase11Router } from './routes.js';
import {
  createRound,
  getPhase11ClientView,
  getRoundClientView,
  pauseCycle,
  seasonalPeriod,
  startOrResumeCycle,
  submitMajorApplicationCheck,
} from './service.js';
import {
  approveStrategy,
  createStrategyDraft,
  getRoundStrategy,
  saveStrategySequence,
  setStrategyCandidate,
} from '../strategies/service.js';
import { DurableAIRuntime } from '../ai/durableRuntime.js';
import { RecordingAIQueue } from '../ai/durableCreditReportPipeline.js';
import {
  Phase7DeterministicProvider,
  phase7Validators,
} from '../ai/durableCreditReportPipeline.js';
import { strategyValidators } from '../strategies/ai.js';

describe('Phase 11 seasonal cycle, paid round, and major application contract', () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrisma(databaseUrl);
  const marker = randomUUID();
  let userId = '';
  let clientId = '';
  let goalId = '';
  let profileId = '';
  let planItemId = '';
  let entitlementId = '';
  let cycleId = '';
  let roundId = '';
  let productId = '';

  beforeAll(async () => {
    await prisma.$connect();
    const user = await prisma.user.create({
      data: {
        email: `phase11-${marker}@example.test`,
        role: 'CLIENT',
        client: {
          create: { firstName: 'Seasonal', lastName: 'Proof', termsAcceptedAt: new Date() },
        },
      },
      include: { client: true },
    });
    userId = user.id;
    clientId = user.client!.id;
    const goal = await prisma.clientGoal.create({
      data: {
        clientId,
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: '50000',
        priority: 'PRIMARY',
        status: 'ACTIVE',
        revisions: {
          create: {
            clientId,
            version: 1,
            goalType: 'TOTAL_AVAILABLE_CREDIT',
            scope: 'PERSONAL',
            targetAmount: '50000',
            allowAnnualFee: false,
            priority: 'PRIMARY',
            status: 'ACTIVE',
          },
        },
      },
    });
    goalId = goal.id;
    const review = await prisma.creditReview.create({
      data: { clientId, status: 'COMPLETE', completedAt: new Date() },
    });
    profileId = (
      await prisma.creditProfileState.create({
        data: { clientId, status: 'CURRENT', sourceReviewId: review.id, effectiveAt: new Date() },
      })
    ).id;
    const plan = await prisma.plan.create({
      data: {
        clientId,
        purpose: 'PREPARATION',
        status: 'ACTIVE',
        title: 'Round preparation',
        versions: {
          create: {
            version: 1,
            status: 'ACTIVE',
            sourceReviewId: review.id,
            sourceReviewVersion: 1,
            sourceProfileVersion: 1,
            sourceFingerprint: `plan-${marker}`,
            items: {
              create: {
                stableKey: 'prepare',
                type: 'ACTION',
                completionMode: 'ACKNOWLEDGEMENT',
                status: 'AVAILABLE',
                owner: 'CLIENT',
                clientTitle: 'Confirm application preparation',
              },
            },
          },
        },
      },
      include: { versions: { include: { items: true } } },
    });
    planItemId = plan.versions[0]!.items[0]!.id;
    entitlementId = (
      await prisma.serviceEntitlement.create({
        data: { clientId, sourceKey: `phase11-${marker}`, serviceType: 'CREDIT_CARD_ROUND' },
      })
    ).id;
    const issuer = await prisma.cardIssuer.create({
      data: { slug: `phase12-${marker}`, name: 'Phase 12 Bank', aliases: [] },
    });
    const product = await prisma.cardProduct.create({
      data: {
        issuerId: issuer.id,
        slug: `phase12-card-${marker}`,
        canonicalName: 'Phase 12 Card',
        displayName: 'Phase 12 Card',
        aliases: [],
        audience: 'PERSONAL',
        portfolioType: 'PERSONAL_CREDIT',
        features: {},
        tags: [],
      },
    });
    const offer = await prisma.cardOfferVersion.create({
      data: {
        productId: product.id,
        version: 1,
        facts: { annualFee: 0 },
        materialFingerprint: marker,
        sourceEvidence: { source: 'test' },
      },
    });
    await prisma.cardProduct.update({
      where: { id: product.id },
      data: { currentOfferVersionId: offer.id },
    });
    productId = product.id;
  });

  afterAll(async () => {
    await prisma.strategyApplication.deleteMany({
      where: { strategyVersion: { strategy: { clientId } } },
    });
    await prisma.strategyCandidate.deleteMany({
      where: { strategyVersion: { strategy: { clientId } } },
    });
    await prisma.roundStrategy.updateMany({
      where: { clientId },
      data: { approvedVersionId: null },
    });
    await prisma.strategyVersion.deleteMany({ where: { strategy: { clientId } } });
    await prisma.aIJobOutput.deleteMany({ where: { job: { clientId } } });
    await prisma.aIJob.deleteMany({ where: { clientId } });
    await prisma.roundStrategy.deleteMany({ where: { clientId } });
    await prisma.workItem.deleteMany({ where: { clientId } });
    await prisma.roundMajorApplicationCheck.deleteMany({ where: { clientId } });
    await prisma.creditCardRound.deleteMany({ where: { clientId } });
    await prisma.applicationCycleStep.deleteMany({ where: { cycle: { clientId } } });
    await prisma.cycleApplication.deleteMany({ where: { cycle: { clientId } } });
    await prisma.cycleGoalSnapshot.deleteMany({ where: { cycle: { clientId } } });
    await prisma.applicationCycle.deleteMany({ where: { clientId } });
    await prisma.nurturePeriod.deleteMany({ where: { clientId } });
    await prisma.creditJourney.deleteMany({ where: { clientId } });
    await prisma.planItemOutcome.deleteMany({
      where: { planItem: { planVersion: { plan: { clientId } } } },
    });
    await prisma.planDependency.deleteMany({
      where: { dependentItem: { planVersion: { plan: { clientId } } } },
    });
    await prisma.planPathItem.deleteMany({
      where: { item: { planVersion: { plan: { clientId } } } },
    });
    await prisma.planPath.deleteMany({ where: { planVersion: { plan: { clientId } } } });
    await prisma.planItem.deleteMany({ where: { planVersion: { plan: { clientId } } } });
    await prisma.planVersion.deleteMany({ where: { plan: { clientId } } });
    await prisma.plan.deleteMany({ where: { clientId } });
    await prisma.serviceEntitlement.deleteMany({ where: { clientId } });
    await prisma.creditProfileState.deleteMany({ where: { clientId } });
    await prisma.creditReview.deleteMany({ where: { clientId } });
    await prisma.clientGoalRevision.deleteMany({ where: { clientId } });
    await prisma.clientGoal.deleteMany({ where: { clientId } });
    await prisma.idempotencyRecord.deleteMany({ where: { subjectId: clientId } });
    await prisma.auditEvent.deleteMany({ where: { clientId } });
    await prisma.outboxEvent.deleteMany({
      where: { payload: { path: ['clientId'], equals: clientId } },
    });
    await prisma.notification.deleteMany({ where: { clientId } });
    await prisma.clientCardWishlist.deleteMany({ where: { clientId } });
    const phase12Product = await prisma.cardProduct.findUnique({
      where: { id: productId },
      select: { issuerId: true },
    });
    await prisma.cardProduct.update({
      where: { id: productId },
      data: { currentOfferVersionId: null },
    });
    await prisma.cardOfferVersion.deleteMany({ where: { productId } });
    await prisma.cardProduct.delete({ where: { id: productId } });
    if (phase12Product) await prisma.cardIssuer.delete({ where: { id: phase12Product.issuerId } });
    await prisma.client.delete({ where: { id: clientId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('11.1 starts one seasonal cycle with immutable goal snapshot and blocks stale resume', async () => {
    expect(seasonalPeriod(new Date('2026-10-01T00:00:00Z'))).toEqual({
      season: 'Fall',
      year: 2026,
      displayName: 'Fall 2026',
    });
    const first = await startOrResumeCycle(prisma, {
      clientId,
      actorId: userId,
      idempotencyKey: `${marker}-cycle`,
    });
    cycleId = first.result.cycleId;
    const replay = await startOrResumeCycle(prisma, {
      clientId,
      actorId: userId,
      idempotencyKey: `${marker}-cycle`,
    });
    expect(replay.replayed).toBe(true);
    expect(await prisma.applicationCycle.count({ where: { clientId } })).toBe(1);
    expect(await prisma.cycleGoalSnapshot.count({ where: { cycleId } })).toBe(1);
    const frozen = await prisma.cycleGoalSnapshot.findUniqueOrThrow({ where: { cycleId } });
    await prisma.clientGoal.update({
      where: { id: goalId },
      data: { targetAmount: '60000', version: { increment: 1 } },
    });
    expect(
      (
        await prisma.cycleGoalSnapshot.findUniqueOrThrow({ where: { cycleId } })
      ).targetAmount?.toString(),
    ).toBe(frozen.targetAmount?.toString());
    await pauseCycle(prisma, {
      clientId,
      actorId: userId,
      cycleId,
      idempotencyKey: `${marker}-pause`,
    });
    await prisma.creditProfileState.update({
      where: { id: profileId },
      data: { status: 'STALE', staleAt: new Date() },
    });
    await expect(
      startOrResumeCycle(prisma, {
        clientId,
        actorId: userId,
        idempotencyKey: `${marker}-stale-resume`,
      }),
    ).rejects.toMatchObject({ code: 'CURRENT_REVIEW_REQUIRED' });
    await prisma.creditProfileState.update({
      where: { id: profileId },
      data: { status: 'CURRENT', staleAt: null },
    });
    await prisma.clientGoal.update({
      where: { id: goalId },
      data: { targetAmount: '50000', version: 1 },
    });
    const resumed = await startOrResumeCycle(prisma, {
      clientId,
      actorId: userId,
      idempotencyKey: `${marker}-resume`,
    });
    expect(resumed.result.resumed).toBe(true);
    expect((await getPhase11ClientView(prisma, clientId)).cycle?.status).toBe('ACTIVE');
  });

  test('11.2 rolls back entitlement on failure, retries exactly once, and keeps payment separate from readiness', async () => {
    await expect(
      createRound(prisma, {
        clientId,
        actorId: userId,
        cycleId,
        idempotencyKey: `${marker}-round`,
        failAfterEntitlement: true,
      }),
    ).rejects.toThrow('PHASE11_FAILURE_INJECTION');
    expect(await prisma.creditCardRound.count({ where: { clientId } })).toBe(0);
    expect(
      await prisma.serviceEntitlement.findUniqueOrThrow({ where: { id: entitlementId } }),
    ).toMatchObject({ status: 'ACTIVE', quantityUsed: 0 });
    const first = await createRound(prisma, {
      clientId,
      actorId: userId,
      cycleId,
      idempotencyKey: `${marker}-round`,
    });
    roundId = first.result.roundId;
    const replay = await createRound(prisma, {
      clientId,
      actorId: userId,
      cycleId,
      idempotencyKey: `${marker}-round`,
    });
    expect(replay.replayed).toBe(true);
    expect(await prisma.creditCardRound.count({ where: { clientId } })).toBe(1);
    expect(
      await prisma.serviceEntitlement.findUniqueOrThrow({ where: { id: entitlementId } }),
    ).toMatchObject({ status: 'CONSUMED', quantityUsed: 1 });
    expect(
      await prisma.auditEvent.count({ where: { clientId, action: 'CREDIT_CARD_ROUND_STARTED' } }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: roundId, eventType: 'credit-card-round.changed' },
      }),
    ).toBe(1);
    expect(first.view.readiness.strategyReady).toBe(false);
    expect(first.view.readiness.blockers).toContain('PREPARATION_INCOMPLETE');
    await prisma.planItem.update({
      where: { id: planItemId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    expect((await getRoundClientView(prisma, roundId, clientId)).readiness.blockers).toContain(
      'MAJOR_CHECK_REQUIRED',
    );
  });

  test('11.3 versions intent, dedupes coordination work, and never creates professional decisions', async () => {
    const no = await submitMajorApplicationCheck(prisma, {
      clientId,
      actorId: userId,
      roundId,
      choice: 'NO',
      idempotencyKey: `${marker}-major-no`,
    });
    expect(no.view.readiness.coordinationRequired).toBe(false);
    expect(no.view.readiness.strategyReady).toBe(true);
    const yes = await submitMajorApplicationCheck(prisma, {
      clientId,
      actorId: userId,
      roundId,
      choice: 'MORTGAGE',
      intendedTiming: 'Within six months',
      clientContext: 'Exploring timing only',
      idempotencyKey: `${marker}-major-yes`,
    });
    expect(yes.view.readiness.coordinationRequired).toBe(true);
    expect(yes.view.readiness.sourceCurrent).toBe(true);
    const replay = await submitMajorApplicationCheck(prisma, {
      clientId,
      actorId: userId,
      roundId,
      choice: 'MORTGAGE',
      intendedTiming: 'Within six months',
      clientContext: 'Exploring timing only',
      idempotencyKey: `${marker}-major-yes`,
    });
    expect(replay.replayed).toBe(true);
    await submitMajorApplicationCheck(prisma, {
      clientId,
      actorId: userId,
      roundId,
      choice: 'NOT_SURE',
      intendedTiming: 'Next year',
      idempotencyKey: `${marker}-major-unsure`,
    });
    expect(await prisma.roundMajorApplicationCheck.count({ where: { roundId } })).toBe(3);
    expect(
      await prisma.workItem.count({ where: { clientId, dedupeKey: `round-major:${roundId}` } }),
    ).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { clientId, action: 'ROUND_MAJOR_APPLICATION_CHECK_SUBMITTED' },
      }),
    ).toBe(3);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: roundId, eventType: 'round-major-application-check.changed' },
      }),
    ).toBe(3);
  });

  test('cross-client read fails closed', async () => {
    await expect(getRoundClientView(prisma, roundId, randomUUID())).rejects.toMatchObject({
      code: 'ROUND_NOT_FOUND',
    });
  });

  test('authenticated seasonal-cycle application route is registered and returns useful seeded-style context', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.auth = {
        userId,
        email: `phase11-${marker}@example.test`,
        role: 'CLIENT',
        status: 'ACTIVE',
        clientId,
      };
      next();
    });
    app.use('/api/v1', createPhase11Router(prisma, {} as AuthorizationService));

    const response = await request(app).get('/api/v1/client/seasonal-cycle').expect(200);
    expect(response.body.currentGoal.id).toBe(goalId);
    expect(response.body.profileState.id).toBe(profileId);
    expect(response.body.cycle.id).toBe(cycleId);
    expect(response.body.cycle.creditCardRounds[0].id).toBe(roundId);
  });

  test('12.1-12.4 freezes sources and approves audit/outbox/notification exactly once with rollback and retry', async () => {
    const draftView = await createStrategyDraft(prisma, { roundId, clientId, actorId: userId });
    const strategy = draftView.strategy;
    expect(strategy.versions).toHaveLength(1);
    const selected = await setStrategyCandidate(prisma, {
      strategyId: strategy.id,
      clientId,
      productId,
      actorId: userId,
      expectedStrategyVersion: 1,
      disposition: 'SHORTLISTED',
      role: 'PLANNED',
      internalRationale: 'Test rationale',
      clientSafeReason: 'Supports your reviewed goal.',
    });
    const candidateId = selected.current!.candidates[0]!.id;
    const outcomeRules = {
      onApproved: 'pause',
      onDeclined: 'stop',
      onPending: 'wait',
      onSkipped: 'review',
      onNotCompleted: 'review',
      onUnexpected: 'stop',
    };
    const sequenced = await saveStrategySequence(prisma, {
      strategyId: strategy.id,
      clientId,
      expectedStrategyVersion: 2,
      items: [
        {
          candidateId,
          sequence: 1,
          role: 'PLANNED',
          timingRule: { instruction: 'confirm offer' },
          dependencyRule: { ready: true },
          stopRule: outcomeRules,
          reconsiderationRule: outcomeRules,
          internalRationale: 'Exact governed offer.',
          clientSafeReason: 'Apply only after your consultant confirms the current offer.',
        },
      ],
    });
    expect(sequenced.validation).toEqual({ valid: true, errors: [] });
    await expect(
      approveStrategy(prisma, {
        strategyId: strategy.id,
        clientId,
        actorId: userId,
        expectedStrategyVersion: 3,
        approvalNote: 'Test approval',
        idempotencyKey: `${marker}-strategy-approval`,
        failAfterMutation: true,
      }),
    ).rejects.toThrow('PHASE12_APPROVAL_FAILURE_INJECTION');
    expect(
      await prisma.roundStrategy.findUniqueOrThrow({ where: { id: strategy.id } }),
    ).toMatchObject({ status: 'READY_FOR_APPROVAL', approvedVersionId: null });
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ROUND_STRATEGY_APPROVED', entityId: sequenced.current!.id },
      }),
    ).toBe(0);
    expect(
      await prisma.notification.count({ where: { clientId, type: 'ROUND_STRATEGY_APPROVED' } }),
    ).toBe(0);
    const concurrent = await Promise.allSettled([
      approveStrategy(prisma, {
        strategyId: strategy.id,
        clientId,
        actorId: userId,
        expectedStrategyVersion: 3,
        approvalNote: 'Test approval',
        idempotencyKey: `${marker}-strategy-approval`,
      }),
      approveStrategy(prisma, {
        strategyId: strategy.id,
        clientId,
        actorId: userId,
        expectedStrategyVersion: 3,
        approvalNote: 'Concurrent approval',
        idempotencyKey: `${marker}-strategy-concurrent`,
      }),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const firstWon = concurrent[0]!.status === 'fulfilled';
    const approved = firstWon
      ? concurrent[0].value
      : (concurrent[1] as PromiseFulfilledResult<Awaited<ReturnType<typeof approveStrategy>>>)
          .value;
    const replay = await approveStrategy(prisma, {
      strategyId: strategy.id,
      clientId,
      actorId: userId,
      expectedStrategyVersion: 3,
      approvalNote: firstWon ? 'Test approval' : 'Concurrent approval',
      idempotencyKey: firstWon ? `${marker}-strategy-approval` : `${marker}-strategy-concurrent`,
    });
    expect(approved.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(
      await prisma.auditEvent.count({
        where: { action: 'ROUND_STRATEGY_APPROVED', entityId: approved.result.versionId },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventType: 'round-strategy.approved', aggregateId: strategy.id },
      }),
    ).toBe(1);
    expect(
      await prisma.notification.count({ where: { clientId, type: 'ROUND_STRATEGY_APPROVED' } }),
    ).toBe(1);
    expect(
      await prisma.creditCardRound.findUniqueOrThrow({ where: { id: roundId } }),
    ).toMatchObject({ status: 'READY_FOR_STRATEGY' });
    const clientProjection = await getRoundStrategy(prisma, roundId, clientId, true);
    const safePayload = JSON.stringify(clientProjection);
    expect(safePayload).not.toContain('internalRationale');
    expect(safePayload).not.toContain('timingRule');
    expect(safePayload).not.toContain('stopRule');
    expect(safePayload).not.toContain('aiProposal');

    await prisma.clientCardWishlist.create({
      data: { clientId, productId, note: 'Material strategy source change' },
    });
    const stale = await getRoundStrategy(prisma, roundId, clientId, true);
    expect(stale).toMatchObject({ stale: true, approved: null, historical: { version: 1 } });
    expect(
      await prisma.strategyVersion.findUniqueOrThrow({ where: { id: approved.result.versionId } }),
    ).toMatchObject({ status: 'STALE' });

    const queue = new RecordingAIQueue();
    const runtime = new DurableAIRuntime(prisma, queue, new Phase7DeterministicProvider(), {
      ...phase7Validators,
      ...strategyValidators,
    });
    const refreshed = await createStrategyDraft(
      prisma,
      { roundId, clientId, actorId: userId },
      runtime,
    );
    expect(refreshed.current).toMatchObject({ version: 2, status: 'DRAFT' });
    expect(refreshed.current!.aiJobId).toBeTruthy();
    await runtime.processJob(refreshed.current!.aiJobId!);
    const hydrated = await getRoundStrategy(prisma, roundId, clientId);
    expect(hydrated.current).toMatchObject({
      version: 2,
      brief: { status: 'AI_PREPARED', authority: 'PROPOSAL_ONLY' },
    });
    expect(hydrated.current!.aiJobOutputId).toBeTruthy();
    expect(await prisma.aIJobOutput.count({ where: { jobId: hydrated.current!.aiJobId! } })).toBe(
      1,
    );
  });
});
