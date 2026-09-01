import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, test } from 'vitest';
import { errorHandler } from '../http/errors.js';
import { createPrisma } from '../lib/prisma.js';
import {
  bindAnonymousGoalIntake,
  bindClaimedGoalIntake,
  cleanupExpiredGoalIntakes,
  prepareGoalIntakeRegistrationClaim,
  createGoalIntakePublicRouter,
} from './goalIntake.js';
import { createPrismaGoalStore } from './prismaGoalStore.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://credit:credit_dev@localhost:5433/credit_strategy_sprint42_test?schema=public';
const prisma = createPrisma(databaseUrl);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const token = (letter: string) => letter.repeat(43);

async function client(label: string) {
  const user = await prisma.user.create({
    data: { email: `goal-${label}-${randomUUID()}@example.com`, name: label, role: 'CLIENT' },
  });
  const value = await prisma.client.create({
    data: {
      userId: user.id,
      firstName: label,
      lastName: 'Client',
      termsAcceptedAt: new Date(),
    },
  });
  return { user, client: value };
}

async function intake(rawToken: string, expiresAt = new Date(Date.now() + 3_600_000)) {
  return prisma.anonymousGoalIntake.create({
    data: {
      tokenHash: hash(rawToken),
      goalType: 'TOTAL_AVAILABLE_CREDIT',
      scope: 'PERSONAL',
      targetAmount: 75_000,
      allowAnnualFee: false,
      cardTypePreference: 'UNSECURED_PREFERRED',
      offerPreferences: ['ZERO_APR', 'BALANCE_TRANSFER'],
      feePreference: 'PREFER_NO_FEE_OPEN',
      preferenceNote: 'Travel rewards are useful.',
      firstName: 'Goal',
      lastName: 'Prospect',
      email: `prospect-${rawToken[0]?.toLowerCase()}@example.com`,
      phone: '+12025550123',
      expiresAt,
    },
  });
}

describe('goal-first intake binding', () => {
  beforeEach(async () => {
    await prisma.outboxEvent.deleteMany({ where: { eventType: 'client.goal.changed' } });
    await prisma.auditEvent.deleteMany({ where: { entityType: 'ClientGoal' } });
    await prisma.clientGoalRevision.deleteMany();
    await prisma.goalIntakeRegistrationClaim.deleteMany();
    await prisma.anonymousGoalIntake.deleteMany();
    await prisma.clientGoal.deleteMany();
    await prisma.client.deleteMany({ where: { user: { email: { startsWith: 'goal-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'goal-' } } });
  });

  afterAll(async () => prisma.$disconnect());

  test('opaque public tokens isolate drafts and support optimistic updates', async () => {
    const app = express();
    app.use(express.json());
    app.use('/goal-intakes', createGoalIntakePublicRouter(prisma));
    app.use(errorHandler(pino({ level: 'silent' })));
    const draft = {
      goalType: 'TOTAL_AVAILABLE_CREDIT',
      scope: 'PERSONAL',
      targetAmount: 60_000,
      allowAnnualFee: false,
      cardTypePreference: 'OPEN_TO_SECURED',
      offerPreferences: ['ZERO_APR', 'BALANCE_TRANSFER', 'REWARDS_POINTS'],
      feePreference: 'PROMOTIONAL_NO_FEE_ACCEPTABLE',
      preferenceNote: 'Prefer travel rewards.',
      firstName: 'Public',
      lastName: 'Prospect',
      email: 'public.prospect@example.com',
      phone: '+12025550124',
    };
    const first = await request(app).post('/goal-intakes').send(draft).expect(201);
    const second = await request(app)
      .post('/goal-intakes')
      .send({ ...draft, targetAmount: 90_000 })
      .expect(201);
    const beforeMalformed = await prisma.anonymousGoalIntake.count();
    await request(app)
      .post('/goal-intakes')
      .send({ ...draft, feePreference: 'NOT_A_REAL_PREFERENCE' })
      .expect(400);
    expect(await prisma.anonymousGoalIntake.count()).toBe(beforeMalformed);
    expect(first.body.token).not.toBe(second.body.token);
    await request(app).get(`/goal-intakes/${first.body.token}`).expect(200);
    expect(first.body.intake).toMatchObject({
      cardTypePreference: 'OPEN_TO_SECURED',
      offerPreferences: ['ZERO_APR', 'BALANCE_TRANSFER', 'REWARDS_POINTS'],
      feePreference: 'PROMOTIONAL_NO_FEE_ACCEPTABLE',
      firstName: 'Public',
      email: 'public.prospect@example.com',
    });
    await request(app)
      .get(`/goal-intakes/${first.body.token.slice(0, -1)}X`)
      .expect(404);
    await request(app)
      .patch(`/goal-intakes/${first.body.token}`)
      .send({ ...draft, targetAmount: 65_000, version: first.body.intake.version })
      .expect(200)
      .expect(({ body }) => expect(body.intake.targetAmount).toBe(65_000));
    await request(app)
      .patch(`/goal-intakes/${first.body.token}`)
      .send({ ...draft, targetAmount: 70_000, version: first.body.intake.version })
      .expect(409);
  });

  test('binds once and duplicate retries create exactly one goal, revision, audit, and outbox effect', async () => {
    const identity = await client('new');
    const record = await intake(token('A'));

    const first = await bindAnonymousGoalIntake(
      prisma,
      token('A'),
      identity.client.id,
      identity.user.id,
    );
    const replay = await bindAnonymousGoalIntake(
      prisma,
      token('A'),
      identity.client.id,
      identity.user.id,
    );

    expect(first.replayed).toBe(false);
    expect(replay).toMatchObject({ replayed: true });
    expect(await prisma.clientGoal.count({ where: { clientId: identity.client.id } })).toBe(1);
    expect(await prisma.clientGoalRevision.count({ where: { clientId: identity.client.id } })).toBe(
      1,
    );
    expect(
      await prisma.auditEvent.count({
        where: { clientId: identity.client.id, entityType: 'ClientGoal' },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({ where: { eventKey: `goal-intake-bound:${record.id}` } }),
    ).toBe(1);
  });

  test('reconciles an existing primary goal without duplicating the user or client', async () => {
    const identity = await client('existing');
    await prisma.clientGoal.create({
      data: {
        clientId: identity.client.id,
        goalType: 'ZERO_APR_CREDIT',
        scope: 'BUSINESS',
        targetAmount: 20_000,
        priority: 'PRIMARY',
      },
    });
    await intake(token('B'));

    await bindAnonymousGoalIntake(prisma, token('B'), identity.client.id, identity.user.id);

    expect(await prisma.user.count({ where: { id: identity.user.id } })).toBe(1);
    expect(await prisma.client.count({ where: { id: identity.client.id } })).toBe(1);
    const goals = await prisma.clientGoal.findMany({ where: { clientId: identity.client.id } });
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({ scope: 'PERSONAL', version: 2 });
  });

  test('fails closed for expired, unknown, or already-consumed tokens', async () => {
    const first = await client('first');
    const second = await client('second');
    await intake(token('C'), new Date(Date.now() - 1_000));
    await intake(token('D'));
    await bindAnonymousGoalIntake(prisma, token('D'), first.client.id, first.user.id);

    await expect(
      bindAnonymousGoalIntake(prisma, token('C'), first.client.id, first.user.id),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      bindAnonymousGoalIntake(prisma, token('D'), second.client.id, second.user.id),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      bindAnonymousGoalIntake(prisma, token('E'), first.client.id, first.user.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('cleanup removes only expired unconsumed intake state', async () => {
    const expired = await intake(token('F'), new Date(Date.now() - 1_000));
    const active = await intake(token('G'));
    expect((await cleanupExpiredGoalIntakes(prisma)).count).toBe(1);
    expect(await prisma.anonymousGoalIntake.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(
      await prisma.anonymousGoalIntake.findUnique({ where: { id: active.id } }),
    ).not.toBeNull();
  });

  test('durable registration claims cannot bind stale intake state to an unrelated user', async () => {
    const record = await intake(token('H'));
    const intended = await client('claim-intended');
    const unrelated = await client('claim-unrelated');
    await prepareGoalIntakeRegistrationClaim(prisma, token('H'), record.email);
    await prepareGoalIntakeRegistrationClaim(prisma, undefined, record.email);

    await expect(
      bindClaimedGoalIntake(prisma, record.email, unrelated.client.id, unrelated.user.id),
    ).resolves.toBeNull();
    expect(await prisma.clientGoal.count({ where: { clientId: unrelated.client.id } })).toBe(0);
    await prepareGoalIntakeRegistrationClaim(prisma, token('H'), record.email);
    await bindClaimedGoalIntake(prisma, record.email, intended.client.id, intended.user.id);
    expect(await prisma.clientGoal.count({ where: { clientId: intended.client.id } })).toBe(1);
    expect(await prisma.goalIntakeRegistrationClaim.count()).toBe(0);
  });

  test('governed goal commands are idempotent and reject stale concurrent changes', async () => {
    const identity = await client('commands');
    const store = createPrismaGoalStore(prisma);
    const input = {
      goalType: 'TOTAL_AVAILABLE_CREDIT' as const,
      scope: 'BOTH' as const,
      targetAmount: 100_000,
      allowAnnualFee: true,
      cardTypePreference: 'SECURED_DESIRED' as const,
      offerPreferences: ['ZERO_APR', 'REWARDS_POINTS'] as const,
      feePreference: 'FEE_ACCEPTABLE' as const,
      preferenceNote: 'Premium travel is acceptable.',
      priority: 'PRIMARY' as const,
    };
    const command = {
      actorId: identity.user.id,
      idempotencyKey: `create-${randomUUID()}`,
      requestHash: 'same-create-request',
    };

    const created = await store.create(identity.client.id, input, command);
    const replay = await store.create(identity.client.id, input, command);
    expect(replay.id).toBe(created.id);
    expect(created).toMatchObject({
      cardTypePreference: 'SECURED_DESIRED',
      offerPreferences: ['ZERO_APR', 'REWARDS_POINTS'],
      feePreference: 'FEE_ACCEPTABLE',
      preferenceNote: 'Premium travel is acceptable.',
    });
    expect(await prisma.clientGoal.count({ where: { clientId: identity.client.id } })).toBe(1);
    expect(
      await prisma.auditEvent.count({ where: { correlationId: command.idempotencyKey } }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventKey: `goal-created:${identity.client.id}:${command.idempotencyKey}` },
      }),
    ).toBe(1);

    const updated = await store.update(
      identity.client.id,
      created.id,
      {
        targetAmount: 125_000,
        offerPreferences: ['BALANCE_TRANSFER'],
        feePreference: 'PROMOTIONAL_NO_FEE_ACCEPTABLE',
        version: created.version,
      },
      {
        actorId: identity.user.id,
        idempotencyKey: `update-${randomUUID()}`,
        requestHash: 'update',
      },
    );
    expect(updated?.version).toBe(created.version + 1);
    expect(updated).toMatchObject({
      offerPreferences: ['BALANCE_TRANSFER'],
      feePreference: 'PROMOTIONAL_NO_FEE_ACCEPTABLE',
    });
    expect(await prisma.clientGoal.count({ where: { clientId: identity.client.id } })).toBe(1);
    await expect(
      store.update(
        identity.client.id,
        created.id,
        { targetAmount: 130_000, version: created.version },
        {
          actorId: identity.user.id,
          idempotencyKey: `stale-${randomUUID()}`,
          requestHash: 'stale',
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
