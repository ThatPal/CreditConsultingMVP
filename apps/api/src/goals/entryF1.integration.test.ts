import { createEmailVerificationToken } from 'better-auth/api';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, test } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createPrisma } from '../lib/prisma.js';
import { loadEnv } from '../config/env.js';
import { createBetterAuth } from '../auth/betterAuth.js';
import { createAuthService } from '../auth/authService.js';
import { createPrismaAuthStore } from '../auth/prismaAuthStore.js';
import { createGoalService } from './service.js';
import { createApp } from '../app.js';
import { createPrismaGoalStore } from './prismaGoalStore.js';
import {
  cleanupExpiredGoalIntakes,
  prepareGoalIntakeRegistrationClaim,
  attachGoalIntakeClaim,
  hashGoalIntakeToken,
} from './goalIntake.js';
import { pendingIntakes, previewIntake, resolveIntake } from './entryIntake.js';
import type { IntakePreview, IntakeResolve } from '@credit/shared';
import type { EmailMessage } from '../notifications/emailProvider.js';

const url = process.env.DATABASE_URL;
if (
  !url ||
  process.env.NODE_ENV === 'production' ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
  new URL(url).pathname !== '/credit_strategy_entry_f1_test'
)
  throw new Error(
    'ENTRY-F1 requires explicit local credit_strategy_entry_f1_test; no fallback or shared target',
  );
const prisma = createPrisma(url);
const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: url,
  REDIS_URL: 'redis://127.0.0.1:6399',
  WEB_ORIGIN: 'http://localhost:5198',
  BETTER_AUTH_URL: 'http://localhost:3018',
  BETTER_AUTH_SECRET: 'entry-f1-disposable-auth-secret-not-for-production',
  SESSION_COOKIE_NAME: 'entry_f1_test',
  AUTH_RATE_LIMIT_ENABLED: 'false',
});
const mail: EmailMessage[] = [];
const provider = {
  name: 'CONSOLE' as const,
  send: async (message: EmailMessage) => {
    mail.push(message);
    return { accepted: true, providerMessageId: randomUUID() };
  },
};
const auth = createBetterAuth(prisma, env, provider);
const app = createApp(
  env,
  pino({ level: 'silent' }),
  createAuthService(createPrismaAuthStore(prisma), env, async () => undefined),
  createGoalService(createPrismaGoalStore(prisma)),
  undefined,
  prisma,
  undefined,
  auth,
  undefined,
  provider,
);
const password = 'Entry-F1-controlled-test-password!';
const values = {
  goalType: 'TOTAL_AVAILABLE_CREDIT' as const,
  scope: 'PERSONAL' as const,
  targetAmount: 75000,
  allowAnnualFee: true,
  cardTypePreference: 'OPEN_TO_SECURED' as const,
  offerPreferences: ['ZERO_APR' as const],
  feePreference: 'FEE_ACCEPTABLE' as const,
  preferenceNote: 'A complete saved preference',
};
async function draft(email = `entry-${randomUUID()}@example.test`) {
  const token = randomBytes(32).toString('base64url');
  const intake = await prisma.anonymousGoalIntake.create({
    data: {
      ...values,
      firstName: 'Entry',
      lastName: 'Test',
      email,
      tokenHash: hashGoalIntakeToken(token),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return { token, intake, locator: { kind: 'TOKEN' as const, value: token } };
}
async function subject() {
  const user = await prisma.user.create({
    data: {
      email: `entry-${randomUUID()}@example.test`,
      name: 'Entry Test',
      role: 'CLIENT',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  const client = await prisma.client.create({
    data: { userId: user.id, firstName: 'Entry', lastName: 'Test', termsAcceptedAt: new Date() },
  });
  return { clientId: client.id, actorId: user.id };
}
function decision(
  view: IntakePreview,
  locator: IntakeResolve['locator'],
  choice: IntakeResolve['decision'] = 'APPLY_SAVED',
): IntakeResolve {
  return {
    locator,
    decision: choice,
    expectedIntakeVersion: view.intakeVersion,
    expectedGoalSetVersion: view.goalSetVersion,
    expectedCurrentGoal: view.currentGoal
      ? { id: view.currentGoal.id, version: view.currentGoal.version }
      : null,
  };
}
async function signup(email: string, extra = {}) {
  return request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', env.WEB_ORIGIN)
    .send({
      email,
      password,
      name: 'Entry Test',
      authTermsAccepted: true,
      callbackURL: '/verify-email',
      ...extra,
    });
}
afterAll(() => prisma.$disconnect());
describe('ENTRY-F1 guarded DB/API contract', () => {
  test('ET10 competing keys for one intake yield one durable outcome and one changed event', async () => {
    const who = await subject();
    const d = await draft();
    const command = decision(await previewIntake(prisma, d.locator, who), d.locator);
    const results = await Promise.allSettled([
      resolveIntake(prisma, command, who, randomUUID()),
      resolveIntake(prisma, command, who, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'INTAKE_ALREADY_RESOLVED' },
    });
    expect(await prisma.goalIntakeResolution.count({ where: { intakeId: d.intake.id } })).toBe(1);
    expect(await prisma.clientGoalRevision.count({ where: { clientId: who.clientId } })).toBe(1);
    expect(
      await prisma.auditEvent.count({
        where: { clientId: who.clientId, action: 'GOAL_INTAKE_RESOLVED' },
      }),
    ).toBe(1);
  });

  test('ET03/ET12 full preference differences apply exactly; secondary collision is never merged', async () => {
    const who = await subject();
    const store = createPrismaGoalStore(prisma);
    const current = await store.create(who.clientId, {
      ...values,
      scope: 'BUSINESS',
      targetAmount: 60000,
      allowAnnualFee: false,
      cardTypePreference: 'UNSECURED_PREFERRED',
      offerPreferences: ['BALANCE_TRANSFER'],
      feePreference: 'NO_ANNUAL_FEE_ONLY',
      preferenceNote: 'Different preference',
      priority: 'PRIMARY',
    });
    const d = await draft();
    const view = await previewIntake(prisma, d.locator, who);
    expect(view.differences.map((d) => d.field)).toEqual(
      expect.arrayContaining([
        'scope',
        'targetAmount',
        'allowAnnualFee',
        'cardTypePreference',
        'offerPreferences',
        'feePreference',
        'preferenceNote',
      ]),
    );
    await resolveIntake(prisma, decision(view, d.locator), who, randomUUID());
    expect((await store.list(who.clientId)).find((g) => g.id === current.id)).toMatchObject({
      ...values,
      version: 2,
    });
    const other = await subject();
    await store.create(other.clientId, { ...values, scope: 'BUSINESS', priority: 'PRIMARY' });
    const secondary = await store.create(other.clientId, { ...values, priority: 'SECONDARY' });
    const conflict = await draft();
    const preview = await previewIntake(prisma, conflict.locator, other);
    expect(preview.state).toBe('TARGET_CONFLICT');
    await expect(
      resolveIntake(prisma, decision(preview, conflict.locator), other, randomUUID()),
    ).rejects.toMatchObject({ code: 'GOAL_TARGET_CONFLICT' });
    await resolveIntake(
      prisma,
      decision(preview, conflict.locator, 'KEEP_CURRENT'),
      other,
      randomUUID(),
    );
    expect((await store.list(other.clientId)).find((g) => g.id === secondary.id)).toEqual(
      secondary,
    );
  });
  test('ET07 concurrent canonical edit and intake decision cannot lose either version check', async () => {
    const who = await subject();
    const store = createPrismaGoalStore(prisma);
    const goal = await store.create(who.clientId, {
      ...values,
      targetAmount: 50000,
      priority: 'PRIMARY',
    });
    const d = await draft();
    const command = decision(await previewIntake(prisma, d.locator, who), d.locator);
    const outcomes = await Promise.allSettled([
      resolveIntake(prisma, command, who, randomUUID()),
      store.update(
        who.clientId,
        goal.id,
        { version: goal.version, targetAmount: 65000 },
        { actorId: who.actorId, idempotencyKey: randomUUID(), requestHash: randomUUID() },
      ),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.clientGoalRevision.count({ where: { goalId: goal.id } })).toBe(2);
    expect(
      (await prisma.client.findUniqueOrThrow({ where: { id: who.clientId } })).goalSetVersion,
    ).toBe(2);
  });

  test('ET05 expired/forged verification and resend preserve intent without granting access', async () => {
    const d = await draft();
    const attempt = randomUUID();
    await signup(d.intake.email, {
      authGoalIntakeToken: d.token,
      authGoalIntakeVersion: 1,
      authEntryAttemptKey: attempt,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: d.intake.email } });
    const callback = env.WEB_ORIGIN + '/verify-email?intake=' + d.token;
    const expired = await createEmailVerificationToken(
      env.BETTER_AUTH_SECRET,
      d.intake.email,
      undefined,
      -60,
    );
    const result = await auth.handler(
      new Request(
        env.BETTER_AUTH_URL +
          '/api/auth/verify-email?token=' +
          expired +
          '&callbackURL=' +
          encodeURIComponent(callback),
      ),
    );
    expect(result.status).toBe(302);
    expect(new URL(result.headers.get('location')!).searchParams.get('error')).toBe(
      'TOKEN_EXPIRED',
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(
      false,
    );
    const unknown = await createEmailVerificationToken(
      env.BETTER_AUTH_SECRET,
      'missing-' + randomUUID() + '@example.test',
    );
    const wrong = await auth.handler(
      new Request(env.BETTER_AUTH_URL + '/api/auth/verify-email?token=' + unknown),
    );
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    const resent = await request(app)
      .post('/api/auth/send-verification-email')
      .set('Origin', env.WEB_ORIGIN)
      .send({ email: d.intake.email, callbackURL: callback });
    expect(resent.status).toBe(200);
    const link = mail
      .filter((m) => m.to === d.intake.email)
      .at(-1)!
      .text!.match(/https?:\/\/[^\s]+/)![0];
    expect(new URL(link).searchParams.get('callbackURL')).toBe(callback);
    await auth.handler(new Request(link));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(
      true,
    );
    expect(await prisma.clientGoal.count({ where: { client: { userId: user.id } } })).toBe(0);
  });
  test('ET12 cleanup retains expired attached and resolved history, removing only eligible unconsumed drafts', async () => {
    const who = await subject();
    const attached = await draft();
    const disposable = await draft();
    const claim = await prepareGoalIntakeRegistrationClaim(
      prisma,
      attached.token,
      attached.intake.email,
      1,
      randomUUID(),
    );
    await attachGoalIntakeClaim(prisma, claim!, who.clientId, who.actorId);
    await prisma.anonymousGoalIntake.updateMany({
      where: { id: { in: [attached.intake.id, disposable.intake.id] } },
      data: { expiresAt: new Date(0) },
    });
    await cleanupExpiredGoalIntakes(prisma);
    expect(
      await prisma.anonymousGoalIntake.findUnique({ where: { id: attached.intake.id } }),
    ).not.toBeNull();
    expect(
      await prisma.anonymousGoalIntake.findUnique({ where: { id: disposable.intake.id } }),
    ).toBeNull();
  });

  test('ET04 staff and unverified clients cannot use the entry decision commands', async () => {
    const who = await subject();
    const d = await draft();
    await prisma.user.update({ where: { id: who.actorId }, data: { emailVerified: false } });
    await expect(previewIntake(prisma, d.locator, who)).rejects.toMatchObject({ status: 403 });
    await prisma.user.update({
      where: { id: who.actorId },
      data: { emailVerified: true, role: 'CONSULTANT' },
    });
    await expect(previewIntake(prisma, d.locator, who)).rejects.toMatchObject({ status: 403 });
  });
  test('ET06 attachment failure preserves successful signup and capability-based recovery', async () => {
    const d = await draft();
    const faulted = prisma.$extends({
      query: {
        goalIntakeRegistrationClaim: {
          async updateMany() {
            throw new Error('CONTROLLED_ATTACHMENT_FAILURE');
          },
        },
      },
    });
    const isolatedAuth = createBetterAuth(faulted as unknown as typeof prisma, env, provider);
    const result = await isolatedAuth.handler(
      new Request(env.BETTER_AUTH_URL + '/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: env.WEB_ORIGIN },
        body: JSON.stringify({
          email: d.intake.email,
          password,
          name: 'Entry Recovery',
          authTermsAccepted: true,
          authGoalIntakeToken: d.token,
          authGoalIntakeVersion: 1,
          authEntryAttemptKey: randomUUID(),
          callbackURL: '/verify-email',
        }),
      }),
    );
    expect(result.status).toBe(200);
    const client = await prisma.client.findFirstOrThrow({
      where: { user: { email: d.intake.email } },
    });
    expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(0);
    expect(
      await prisma.goalIntakeRegistrationClaim.count({ where: { attachedClientId: client.id } }),
    ).toBe(0);
    const verification = mail
      .filter((m) => m.to === d.intake.email)
      .at(-1)
      ?.text?.match(/https?:\/\/[^\s]+/)?.[0];
    expect(verification).toBeTruthy();
    await isolatedAuth.handler(new Request(verification!, { redirect: 'manual' }));
    expect(
      (await previewIntake(prisma, d.locator, { actorId: client.userId, clientId: client.id }))
        .state,
    ).toBe('NO_PRIMARY');
  });
  test('ET06/ET12 multiple pending claims are explicit, owned, independently resolvable; legacy email-only claims stay unattached', async () => {
    const who = await subject();
    const other = await subject();
    const a = await draft();
    const b = await draft();
    const claims = await Promise.all(
      [a, b].map((d) =>
        prepareGoalIntakeRegistrationClaim(prisma, d.token, d.intake.email, 1, randomUUID()),
      ),
    );
    for (const id of claims) await attachGoalIntakeClaim(prisma, id!, who.clientId, who.actorId);
    const ordered = (await pendingIntakes(prisma, who)).entries.map((e) => e.claimId);
    expect(ordered).toEqual(expect.arrayContaining(claims));
    expect((await pendingIntakes(prisma, who)).entries.map((e) => e.claimId)).toEqual(ordered);
    expect((await pendingIntakes(prisma, other)).count).toBe(0);
    const selected = { kind: 'CLAIM' as const, id: claims[0]! };
    await resolveIntake(
      prisma,
      decision(await previewIntake(prisma, selected, who), selected),
      who,
      randomUUID(),
    );
    expect((await pendingIntakes(prisma, who)).entries.map((e) => e.claimId)).toEqual([claims[1]]);
    const legacy = await draft();
    await prisma.goalIntakeRegistrationClaim.create({
      data: {
        registrationEmailHash: hashGoalIntakeToken(legacy.intake.email),
        intakeTokenHash: legacy.intake.tokenHash,
        expiresAt: legacy.intake.expiresAt,
      },
    });
    expect((await signup(legacy.intake.email)).status).toBe(200);
    expect(
      await prisma.goalIntakeRegistrationClaim.findFirst({
        where: { intakeTokenHash: legacy.intake.tokenHash },
      }),
    ).toMatchObject({ attachedClientId: null, attachedUserId: null });
  });
  test('ET14 applying changed preferences preserves currentAmount, unrelated Goals and historical cycle snapshots', async () => {
    const who = await subject();
    const store = createPrismaGoalStore(prisma);
    const goal = await store.create(who.clientId, {
      ...values,
      targetAmount: 50000,
      priority: 'PRIMARY',
    });
    await prisma.clientGoal.update({ where: { id: goal.id }, data: { currentAmount: 12000 } }); // fixture, not an application writer
    const unrelated = await store.create(who.clientId, {
      ...values,
      scope: 'BUSINESS',
      priority: 'SECONDARY',
    });
    const journey = await prisma.creditJourney.create({ data: { clientId: who.clientId } });
    const cycle = await prisma.applicationCycle.create({
      data: { clientId: who.clientId, journeyId: journey.id, cycleNumber: 1 },
    });
    const snapshot = await prisma.cycleGoalSnapshot.create({
      data: {
        cycleId: cycle.id,
        sourceGoalId: goal.id,
        sourceGoalVersion: goal.version,
        ...values,
        targetAmount: 50000,
      },
    });
    const d = await draft();
    const view = await previewIntake(prisma, d.locator, who);
    const result = await resolveIntake(prisma, decision(view, d.locator), who, randomUUID());
    expect(result.resolution.effect).toBe('UPDATED');
    const current = await prisma.clientGoal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(current.currentAmount?.toNumber()).toBe(12000);
    expect(current.targetAmount?.toNumber()).toBe(75000);
    expect(
      await prisma.cycleGoalSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } }),
    ).toEqual(snapshot);
    expect(
      (await prisma.clientGoal.findUniqueOrThrow({ where: { id: unrelated.id } })).version,
    ).toBe(unrelated.version);
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({
        where: { eventKey: `entry-goal-changed:${d.intake.id}` },
      }),
    ).toMatchObject({
      eventType: 'client.goal.changed',
      payload: {
        clientId: who.clientId,
        domains: ['goals'],
        refetch: true,
        reassessmentRequired: true,
      },
    });
  });
  test('ET01 ordinary registration creates identity without Goal or claim changes', async () => {
    const before = await prisma.goalIntakeRegistrationClaim.count();
    const email = `ordinary-${randomUUID()}@example.test`;
    const response = await signup(email);
    expect(response.status).toBe(200);
    const client = await prisma.client.findFirstOrThrow({ where: { user: { email } } });
    expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(0);
    expect(await prisma.goalIntakeRegistrationClaim.count()).toBe(before);
  });
  test('ET02/ET05 real signup, captured verification, sign-in and explicit API decision', async () => {
    const d = await draft();
    const response = await signup(d.intake.email, {
      authGoalIntakeToken: d.token,
      authGoalIntakeVersion: 1,
      authEntryAttemptKey: randomUUID(),
    });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(d.token);
    const client = await prisma.client.findFirstOrThrow({
      where: { user: { email: d.intake.email } },
    });
    expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(0);
    const claim = await prisma.goalIntakeRegistrationClaim.findFirstOrThrow({
      where: { intakeTokenHash: hashGoalIntakeToken(d.token) },
    });
    expect(claim.attachedClientId).toBe(client.id);
    const blocked = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', env.WEB_ORIGIN)
      .send({ email: d.intake.email, password });
    expect(blocked.status).toBe(403);
    const message = mail.filter((m) => m.to === d.intake.email).at(-1)!;
    const verification = (message.text ?? '').match(/https?:\/\/[^\s]+/)?.[0];
    expect(verification).toBeTruthy();
    const verify = await auth.handler(new Request(verification!, { redirect: 'manual' }));
    expect([200, 302]).toContain(verify.status);
    const signed = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', env.WEB_ORIGIN)
      .send({ email: d.intake.email, password });
    expect(signed.status).toBe(200);
    const cookie = (signed.headers['set-cookie'] as unknown as string[])
      .map((v) => v.split(';')[0])
      .join('; ');
    const preview = await request(app)
      .post('/api/v1/client/goal-intakes/preview')
      .set('Cookie', cookie)
      .set('X-Credit-Actor', client.userId)
      .send({ locator: d.locator });
    expect(preview.status).toBe(200);
    expect(preview.headers['cache-control']).toBe('no-store');
    const body = decision(preview.body, d.locator);
    const applied = await request(app)
      .post('/api/v1/client/goal-intakes/resolve')
      .set('Cookie', cookie)
      .set('X-Credit-Actor', client.userId)
      .set('Idempotency-Key', randomUUID())
      .send(body);
    expect(applied.status).toBe(200);
    expect(applied.body.resolution.effect).toBe('CREATED');
    expect(await prisma.clientGoal.count({ where: { clientId: client.id } })).toBe(1);
    expect(
      await Promise.all([
        prisma.creditJourney.count({ where: { clientId: client.id } }),
        prisma.applicationCycle.count({ where: { clientId: client.id } }),
        prisma.creditReview.count({ where: { clientId: client.id } }),
        prisma.servicePurchase.count({ where: { clientId: client.id } }),
        prisma.payment.count({ where: { clientId: client.id } }),
        prisma.serviceEntitlement.count({ where: { clientId: client.id } }),
      ]),
    ).toEqual([0, 0, 0, 0, 0, 0]);
  });
  test('ET03 preview is effect-free; Apply, matching confirmation and Keep preserve exact semantics', async () => {
    const who = await subject();
    const d = await draft();
    const view = await previewIntake(prisma, d.locator, who);
    expect(view.state).toBe('NO_PRIMARY');
    expect(await prisma.clientGoal.count({ where: { clientId: who.clientId } })).toBe(0);
    const applied = await resolveIntake(prisma, decision(view, d.locator), who, randomUUID());
    expect(applied.resolution.effect).toBe('CREATED');
    const matching = await draft();
    const same = await previewIntake(prisma, matching.locator, who);
    expect(same.state).toBe('MATCHING');
    expect(
      (await resolveIntake(prisma, decision(same, matching.locator), who, randomUUID())).resolution
        .effect,
    ).toBe('UNCHANGED');
    const kept = await draft();
    const keepView = await previewIntake(prisma, kept.locator, who);
    expect(
      (
        await resolveIntake(
          prisma,
          decision(keepView, kept.locator, 'KEEP_CURRENT'),
          who,
          randomUUID(),
        )
      ).resolution.effect,
    ).toBe('KEPT');
    expect(
      (await prisma.client.findUniqueOrThrow({ where: { id: who.clientId } })).goalSetVersion,
    ).toBe(1);
    expect(await prisma.clientGoalRevision.count({ where: { clientId: who.clientId } })).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: {
          eventType: 'client.goal.changed',
          payload: { path: ['clientId'], equals: who.clientId },
        },
      }),
    ).toBe(1);
  });
  test('ET06 same-email competing real signups attach only the winning request claim', async () => {
    const email = `concurrent-${randomUUID()}@example.test`;
    const one = await draft(email);
    const two = await draft(email);
    const keys = [randomUUID(), randomUUID()];
    const results = await Promise.all(
      [one, two].map((d, i) =>
        signup(email, {
          authGoalIntakeToken: d.token,
          authGoalIntakeVersion: 1,
          authEntryAttemptKey: keys[i],
        }),
      ),
    );
    const actual = await prisma.user.findUniqueOrThrow({ where: { email } });
    const winner = results.findIndex((r) => r.body.user?.id === actual.id);
    expect(winner).toBeGreaterThanOrEqual(0);
    const attached = await prisma.goalIntakeRegistrationClaim.findMany({
      where: { registrationEmailHash: hashGoalIntakeToken(email), attachedClientId: { not: null } },
    });
    expect(attached).toHaveLength(1);
    expect(attached[0]?.intakeTokenHash).toBe(hashGoalIntakeToken([one, two][winner]!.token));
    await expect(
      prepareGoalIntakeRegistrationClaim(prisma, two.token, email, 1, keys[0]),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
  test('ET07 no-primary race and primary demotion are guarded by collection epoch and revisions', async () => {
    const who = await subject();
    const d = await draft();
    const old = await previewIntake(prisma, d.locator, who);
    const store = createPrismaGoalStore(prisma);
    const first = await store.create(who.clientId, { ...values, priority: 'PRIMARY' });
    await expect(
      resolveIntake(prisma, decision(old, d.locator), who, randomUUID()),
    ).rejects.toMatchObject({ code: 'STALE_GOAL_CONTEXT' });
    await store.create(who.clientId, { ...values, scope: 'BUSINESS', priority: 'PRIMARY' });
    const demoted = await prisma.clientGoal.findUniqueOrThrow({ where: { id: first.id } });
    expect(demoted.priority).toBe('SECONDARY');
    expect(demoted.version).toBe(2);
    expect(await prisma.clientGoalRevision.count({ where: { goalId: first.id } })).toBe(2);
  });
  test('ET08 public edits use the actual loaded revision and reject stale two-tab submissions', async () => {
    const d = await draft();
    const body = {
      ...values,
      firstName: 'Entry',
      lastName: 'Test',
      email: d.intake.email,
      version: 1,
    };
    expect((await request(app).patch(`/api/v1/goal-intakes/${d.token}`).send(body)).status).toBe(
      200,
    );
    const stale = await request(app)
      .patch(`/api/v1/goal-intakes/${d.token}`)
      .send({ ...body, targetAmount: 90000 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_INTAKE');
  });
  test('ET10 duplicate retry returns historical resolution after a later Goal edit; changed payload and different key conflict', async () => {
    const who = await subject();
    const d = await draft();
    const body = decision(await previewIntake(prisma, d.locator, who), d.locator);
    const key = randomUUID();
    const original = await resolveIntake(prisma, body, who, key);
    await createPrismaGoalStore(prisma).update(who.clientId, original.resolution.goalId, {
      targetAmount: 120000,
    });
    await prisma.anonymousGoalIntake.update({
      where: { id: d.intake.id },
      data: { expiresAt: new Date(0) },
    });
    const retry = await resolveIntake(prisma, body, who, key);
    expect(retry.replayed).toBe(true);
    expect(retry.resolution).toEqual(original.resolution);
    await expect(
      resolveIntake(prisma, { ...body, decision: 'KEEP_CURRENT' }, who, key),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await expect(resolveIntake(prisma, body, who, randomUUID())).rejects.toMatchObject({
      code: 'INTAKE_ALREADY_RESOLVED',
    });
  });
  test('ET11 wrong client cannot preview or replay an attached capability', async () => {
    const owner = await subject();
    const other = await subject();
    const d = await draft();
    const claim = await prepareGoalIntakeRegistrationClaim(
      prisma,
      d.token,
      d.intake.email,
      1,
      randomUUID(),
    );
    await attachGoalIntakeClaim(prisma, claim!, owner.clientId, owner.actorId);
    await expect(previewIntake(prisma, d.locator, other)).rejects.toMatchObject({
      code: 'INTAKE_UNAVAILABLE',
    });
  });
  test.each([
    'clientGoal',
    'clientGoalRevision',
    'client',
    'goalIntakeResolution',
    'anonymousGoalIntake',
    'auditEvent',
    'outboxEvent',
  ] as const)(
    'ET11 real transaction rolls back an injected failure after %s write',
    async (model) => {
      const who = await subject();
      const d = await draft();
      const body = decision(await previewIntake(prisma, d.locator, who), d.locator);
      const key = randomUUID();
      const faulted = prisma.$extends({
        query: {
          $allModels: {
            async $allOperations({ model: actual, operation, args, query }) {
              const result = await query(args);
              if (
                actual[0]!.toLowerCase() + actual.slice(1) === model &&
                ['create', 'update'].includes(operation)
              ) {
                if (
                  model !== 'outboxEvent' ||
                  (args as { data: { eventType?: string } }).data.eventType ===
                    'goal-intake.resolved'
                )
                  throw new Error('ENTRY_TEST_FAULT');
              }
              return result;
            },
          },
        },
      });
      await expect(
        resolveIntake(faulted as unknown as typeof prisma, body, who, key),
      ).rejects.toThrow('ENTRY_TEST_FAULT');
      expect(await prisma.clientGoal.count({ where: { clientId: who.clientId } })).toBe(0);
      expect(await prisma.clientGoalRevision.count({ where: { clientId: who.clientId } })).toBe(0);
      expect(await prisma.goalIntakeResolution.count({ where: { intakeId: d.intake.id } })).toBe(0);
      expect(
        (await prisma.anonymousGoalIntake.findUniqueOrThrow({ where: { id: d.intake.id } }))
          .consumedAt,
      ).toBeNull();
      expect(
        (await prisma.client.findUniqueOrThrow({ where: { id: who.clientId } })).goalSetVersion,
      ).toBe(0);
      expect(await prisma.auditEvent.count({ where: { clientId: who.clientId } })).toBe(0);
      expect(
        await prisma.outboxEvent.count({
          where: {
            eventKey: {
              in: [`entry-goal-changed:${d.intake.id}`, `goal-intake-resolved:${d.intake.id}`],
            },
          },
        }),
      ).toBe(0);
      expect((await resolveIntake(prisma, body, who, key)).resolution.effect).toBe('CREATED');
    },
  );
  test('ET07 two simultaneous intake decisions cannot overwrite a newly created primary', async () => {
    const who = await subject();
    const a = await draft();
    const b = await draft();
    const commands = await Promise.all(
      [a, b].map(async (d) => decision(await previewIntake(prisma, d.locator, who), d.locator)),
    );
    const outcomes = await Promise.allSettled(
      commands.map((body) => resolveIntake(prisma, body, who, randomUUID())),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'STALE_GOAL_CONTEXT' },
    });
    expect(await prisma.clientGoal.count({ where: { clientId: who.clientId } })).toBe(1);
  });
  test('ET12 legacy consumed intakes never infer the current primary as an outcome; target collisions are explicit', async () => {
    const who = await subject();
    const d = await draft();
    await prisma.anonymousGoalIntake.update({
      where: { id: d.intake.id },
      data: { consumedAt: new Date(), consumedByClientId: who.clientId },
    });
    await expect(previewIntake(prisma, d.locator, who)).rejects.toMatchObject({
      code: 'LEGACY_RESOLUTION_UNAVAILABLE',
    });
    await createPrismaGoalStore(prisma).create(who.clientId, {
      ...values,
      goalType: 'BUSINESS_CREDIT',
      priority: 'PRIMARY',
    });
    const next = await draft();
    expect((await previewIntake(prisma, next.locator, who)).state).toBe('TARGET_CONFLICT');
  });
});
