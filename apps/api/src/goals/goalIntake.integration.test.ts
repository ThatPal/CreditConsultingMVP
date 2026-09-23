import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
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

const databaseUrl = process.env.DATABASE_URL;
if (
  !databaseUrl ||
  process.env.NODE_ENV === 'production' ||
  new URL(databaseUrl).pathname !== '/credit_strategy_entry_f1_test' ||
  !['127.0.0.1', 'localhost'].includes(new URL(databaseUrl).hostname)
)
  throw new Error('ENTRY-F1 requires its explicitly named local disposable database');
const prisma = createPrisma(databaseUrl);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const runId = randomUUID();
const token = (letter: string) =>
  createHash('sha256')
    .update(runId + letter)
    .digest('base64url');

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

  test('legacy automatic bind is rejected without creating a Goal', async () => {
    const identity = await client('legacy');
    await intake(token('A'));
    await expect(
      bindAnonymousGoalIntake(prisma, token('A'), identity.client.id, identity.user.id),
    ).rejects.toMatchObject({ code: 'INTAKE_DECISION_REQUIRED', status: 400 });
    expect(await prisma.clientGoal.count({ where: { clientId: identity.client.id } })).toBe(0);
  });

  test('cleanup removes only expired unconsumed intake state', async () => {
    const expired = await intake(token('F'), new Date(Date.now() - 1_000));
    const active = await intake(token('G'));
    await cleanupExpiredGoalIntakes(prisma);
    expect(await prisma.anonymousGoalIntake.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(
      await prisma.anonymousGoalIntake.findUnique({ where: { id: active.id } }),
    ).not.toBeNull();
  });

  test('durable registration claims cannot bind stale intake state to an unrelated user', async () => {
    const record = await intake(token('H'));
    const intended = await client('claim-intended');
    const unrelated = await client('claim-unrelated');
    await prepareGoalIntakeRegistrationClaim(
      prisma,
      token('H'),
      record.email,
      1,
      'same-attempt-key-0001',
    );
    await prepareGoalIntakeRegistrationClaim(prisma, undefined, record.email);

    await expect(
      bindClaimedGoalIntake(prisma, record.email, unrelated.client.id, unrelated.user.id),
    ).resolves.toBeNull();
    expect(await prisma.clientGoal.count({ where: { clientId: unrelated.client.id } })).toBe(0);
    await prepareGoalIntakeRegistrationClaim(
      prisma,
      token('H'),
      record.email,
      1,
      'same-attempt-key-0001',
    );
    await bindClaimedGoalIntake(prisma, record.email, intended.client.id, intended.user.id);
    expect(await prisma.clientGoal.count({ where: { clientId: intended.client.id } })).toBe(0);
    expect(
      await prisma.goalIntakeRegistrationClaim.count({
        where: { intakeTokenHash: record.tokenHash },
      }),
    ).toBe(1);
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
