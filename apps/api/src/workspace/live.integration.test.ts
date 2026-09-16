import { randomUUID } from 'node:crypto';
import { expect, test } from 'vitest';
import { createPrisma } from '../lib/prisma.js';
import { getCreditWorkspace } from './service.js';
import { getPublishedCreditCenter } from '../reviews/publishedCreditCenter.js';
import { startApplicationSession, assertSessionParticipant } from '../live/sessions.js';
import { clearRestrictions } from '../majorReadiness/service.js';

test('persisted Round, Strategy, Appointment and Live reads obey lifecycle, scope and coordination', async () => {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('127.0.0.1:5446/credit_strategy_astra_u0'))
    throw Error('Isolated Astra test database required');
  const db = createPrisma(url);
  const actor = randomUUID(),
    client = randomUUID(),
    other = randomUUID(),
    journey = randomUUID(),
    cycle = randomUUID(),
    goal = randomUUID(),
    snapshot = randomUUID(),
    profile = randomUUID(),
    entitlement = randomUUID(),
    round = randomUUID(),
    strategy = randomUUID(),
    version = randomUUID(),
    appointment = randomUUID(),
    major = randomUUID();
  const now = new Date();
  const start = new Date(now.getTime() - 60_000),
    end = new Date(now.getTime() + 30 * 60_000);
  try {
    await db.user.create({
      data: {
        id: actor,
        email: `live-${actor}@example.test`,
        role: 'CONSULTANT',
        status: 'ACTIVE',
      },
    });
    for (const id of [client, other])
      await db.client.create({
        data: {
          id,
          firstName: 'Synthetic',
          lastName: 'Live fixture',
          assignedConsultantId: actor,
          termsAcceptedAt: now,
        },
      });
    await db.creditJourney.create({ data: { id: journey, clientId: client } });
    await db.applicationCycle.create({
      data: { id: cycle, clientId: client, journeyId: journey, cycleNumber: 1 },
    });
    await db.clientGoal.create({
      data: {
        id: goal,
        clientId: client,
        goalType: 'PERSONAL_CREDIT',
        scope: 'PERSONAL',
        priority: 'PRIMARY',
      },
    });
    await db.cycleGoalSnapshot.create({
      data: {
        id: snapshot,
        cycleId: cycle,
        sourceGoalId: goal,
        sourceGoalVersion: 1,
        goalType: 'PERSONAL_CREDIT',
        scope: 'PERSONAL',
        allowAnnualFee: false,
        cardTypePreference: 'NO_PREFERENCE',
        feePreference: 'NO_ANNUAL_FEE_ONLY',
      },
    });
    await db.creditProfileState.create({
      data: { id: profile, clientId: client, status: 'CURRENT' },
    });
    await db.serviceEntitlement.create({
      data: { id: entitlement, clientId: client, serviceType: 'CREDIT_CARD_ROUND' },
    });
    await db.creditCardRound.create({
      data: {
        id: round,
        clientId: client,
        cycleId: cycle,
        goalSnapshotId: snapshot,
        profileStateId: profile,
        serviceEntitlementId: entitlement,
        status: 'READY_FOR_STRATEGY',
        sourceFingerprint: 'private-fixture-fingerprint',
        sourceContext: { private: 'source' },
      },
    });
    await db.roundStrategy.create({ data: { id: strategy, roundId: round, clientId: client } });
    await db.strategyVersion.create({
      data: {
        id: version,
        strategyId: strategy,
        version: 1,
        status: 'APPROVED',
        sourceFingerprint: 'private-version-fingerprint',
        sourceContext: {},
        brief: {},
        rules: {},
        createdByUserId: actor,
        approvedByUserId: actor,
        approvedAt: now,
      },
    });
    await db.roundStrategy.update({
      where: { id: strategy },
      data: { status: 'APPROVED', approvedVersionId: version },
    });
    await db.appointment.create({
      data: {
        id: appointment,
        clientId: client,
        consultantId: actor,
        roundId: round,
        strategyVersionId: version,
        startsAt: start,
        endsAt: end,
        timezone: 'America/New_York',
      },
    });
    const scheduled = await getCreditWorkspace(db, client);
    expect(scheduled.currentFocus).toMatchObject({
      code: 'APPOINTMENT_UPCOMING',
      action: `/app/rounds/${round}/schedule`,
    });
    expect(scheduled.refreshAt).toEqual(end);
    expect((await getCreditWorkspace(db, other)).nextAppointment).toBeNull();
    await db.appointment.update({ where: { id: appointment }, data: { status: 'CANCELLED' } });
    expect((await getCreditWorkspace(db, client)).nextAppointment).toBeNull();
    const command = () =>
      startApplicationSession(db, {
        appointmentId: appointment,
        consultantId: actor,
        actorId: actor,
        idempotencyKey: randomUUID(),
      });
    await expect(command()).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_JOINABLE' });
    await db.appointment.update({ where: { id: appointment }, data: { status: 'BOOKED' } });
    await db.roundStrategy.update({ where: { id: strategy }, data: { status: 'STALE' } });
    await expect(command()).rejects.toMatchObject({ code: 'STRATEGY_NOT_CURRENT' });
    await db.roundStrategy.update({ where: { id: strategy }, data: { status: 'APPROVED' } });
    for (const status of ['BLOCKED', 'COMPLETE', 'CANCELLED'] as const) {
      await db.creditCardRound.update({ where: { id: round }, data: { status } });
      await expect(command()).rejects.toMatchObject({ code: 'ROUND_NOT_ACTIVE' });
      expect(await db.applicationSession.count({ where: { roundId: round } })).toBe(0);
    }
    await db.creditCardRound.update({
      where: { id: round },
      data: { status: 'READY_FOR_STRATEGY' },
    });
    await expect(
      startApplicationSession(db, {
        appointmentId: appointment,
        consultantId: randomUUID(),
        actorId: actor,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'APPOINTMENT_NOT_JOINABLE' });
    await command();
    const session = await db.applicationSession.findUniqueOrThrow({ where: { roundId: round } });
    expect(session.status).toBe('WAITING_FOR_CLIENT');
    for (const status of [
      'LIVE',
      'PAUSED',
      'WAITING_FOR_CLIENT',
      'WAITING_FOR_CONSULTANT',
    ] as const) {
      await db.applicationSession.update({
        where: { id: session.id },
        data: { status, endedAt: null },
      });
      const workspace = await getCreditWorkspace(db, client);
      expect(workspace.currentFocus.action).toBe(`/app/rounds/${round}/live`);
      expect(workspace.currentFocus.owner).toBe(
        ['PAUSED', 'WAITING_FOR_CONSULTANT'].includes(status) ? 'CONSULTANT' : 'CLIENT',
      );
      expect((await getPublishedCreditCenter(db, client)).workspace.currentFocus).toEqual(
        workspace.currentFocus,
      );
      expect(JSON.stringify(workspace)).not.toContain('private-fixture');
    }
    expect((await getCreditWorkspace(db, other)).sources.liveSession).toBeNull();
    await expect(
      assertSessionParticipant(db, session.id, {
        userId: randomUUID(),
        clientId: other,
        role: 'CLIENT',
      }),
    ).rejects.toMatchObject({ status: 403 });
    await db.majorReadinessCase.create({
      data: {
        id: major,
        clientId: client,
        intentType: 'MORTGAGE',
        status: 'COORDINATION',
        createdByUserId: actor,
      },
    });
    const rec = await db.majorReadinessRecommendation.create({
      data: {
        caseId: major,
        version: 1,
        type: 'PREPARE_FIRST',
        clientSafeExplanation: 'Coordinate timing',
        sourceFingerprint: 'fixture',
        sourceSnapshot: {},
        approvedByUserId: actor,
        approvedAt: now,
      },
    });
    const decision = await db.coordinationDecision.create({
      data: {
        caseId: major,
        version: 1,
        type: 'PAUSE_CARD_ACTIVITY',
        clientSafeExplanation: 'Wait for your consultant',
        sourceRecommendationId: rec.id,
        decidedByUserId: actor,
      },
    });
    await db.clientCreditActivityRestriction.create({
      data: {
        clientId: client,
        caseId: major,
        decisionId: decision.id,
        scope: 'LIVE_EXECUTION',
        reasonCode: 'PAUSE_CARD_ACTIVITY',
      },
    });
    await db.applicationSession.update({ where: { id: session.id }, data: { status: 'LIVE' } });
    expect((await getCreditWorkspace(db, client)).currentFocus.code).toBe('LIVE_RESTRICTED');
    await expect(command()).rejects.toMatchObject({ status: 409 });
    await clearRestrictions(db, {
      caseId: major,
      clientId: client,
      actorId: actor,
      reason: 'Fixture reassessment',
      idempotencyKey: randomUUID(),
    });
    expect((await db.roundStrategy.findUniqueOrThrow({ where: { id: strategy } })).status).toBe(
      'STALE',
    );
    await expect(command()).rejects.toMatchObject({ code: 'STRATEGY_NOT_CURRENT' });
    await db.applicationSession.update({ where: { id: session.id }, data: { endedAt: now } });
    expect((await getCreditWorkspace(db, client)).sources.liveSession).toBeNull();
    for (const status of ['SCHEDULED', 'READY', 'ENDED'] as const) {
      await db.applicationSession.update({
        where: { id: session.id },
        data: { status, endedAt: null },
      });
      expect((await getCreditWorkspace(db, client)).sources.liveSession).toBeNull();
    }
  } finally {
    await db.outboxEvent.deleteMany({ where: { payload: { path: ['clientId'], equals: client } } });
    await db.auditEvent.deleteMany({ where: { clientId: client } });
    await db.idempotencyRecord.deleteMany({ where: { subjectId: { in: [client, actor, major] } } });
    await db.majorReadinessEvent.deleteMany({ where: { caseId: major } });
    await db.clientCreditActivityRestriction.deleteMany({ where: { caseId: major } });
    await db.coordinationDecision.deleteMany({ where: { caseId: major } });
    await db.majorReadinessRecommendation.deleteMany({ where: { caseId: major } });
    await db.majorReadinessCase.deleteMany({ where: { id: major } });
    await db.applicationSession.deleteMany({ where: { roundId: round } });
    await db.appointment.deleteMany({ where: { id: appointment } });
    await db.roundStrategy.updateMany({
      where: { id: strategy },
      data: { approvedVersionId: null },
    });
    await db.strategyVersion.deleteMany({ where: { id: version } });
    await db.roundStrategy.deleteMany({ where: { id: strategy } });
    await db.creditCardRound.deleteMany({ where: { id: round } });
    await db.serviceEntitlement.deleteMany({ where: { id: entitlement } });
    await db.creditProfileState.deleteMany({ where: { id: profile } });
    await db.cycleGoalSnapshot.deleteMany({ where: { id: snapshot } });
    await db.clientGoal.deleteMany({ where: { id: goal } });
    await db.applicationCycle.deleteMany({ where: { id: cycle } });
    await db.creditJourney.deleteMany({ where: { id: journey } });
    await db.client.deleteMany({ where: { id: { in: [client, other] } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.$disconnect();
  }
}, 30000);
