import { createHash, createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import type { EmailMessage, EmailProvider } from '../notifications/emailProvider.js';
import { createBetterAuth, deriveMfaAssurance, resolveBetterAuthPrincipal } from './betterAuth.js';
import { hashPassword } from './security.js';
import { resetReviewStaffMfa } from '../seeding/reviewMfaReset.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://credit:credit_dev@localhost:5433/credit_strategy?schema=public';
const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  REDIS_URL: 'redis://localhost:6380',
  WEB_ORIGIN: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:3001',
  BETTER_AUTH_SECRET: 'sprint-2.1-integration-test-secret-at-least-32-characters',
  AUTH_RATE_LIMIT_ENABLED: 'false',
});
const prisma = createPrisma(databaseUrl);
const messages: EmailMessage[] = [];
const provider: EmailProvider = {
  name: 'CONSOLE',
  async send(message) {
    messages.push(message);
    return { accepted: true, providerMessageId: randomUUID() };
  },
};
const auth = createBetterAuth(prisma, env, provider);
const rateLimitedAuth = createBetterAuth(
  prisma,
  loadEnv({
    ...env,
    AUTH_RATE_LIMIT_ENABLED: 'true',
    AUTH_RATE_LIMIT_WINDOW_SECONDS: '60',
    AUTH_RATE_LIMIT_MAX: '2',
  }),
  provider,
);
const suffix = randomUUID();
const email = `sprint21-${suffix}@example.com`;
const secondEmail = `sprint21-other-${suffix}@example.com`;
const staffEmail = `sprint41-staff-${suffix}@example.com`;
const adminEmail = `sprint41-admin-${suffix}@example.com`;
const goalRegistrationEmail = `goal-registration-${suffix}@example.com`;

async function waitForAudit(action: string, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  do {
    const event = await prisma.auditEvent.findFirst({
      where: { action },
      orderBy: { createdAt: 'desc' },
    });
    if (event) return event;
    await new Promise((resolve) => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${action} audit event`);
}
const password = 'Correct-Horse-Battery-21!';

async function call(
  pathOrUrl: string,
  options: { body?: unknown; cookie?: string; method?: string } = {},
) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${env.BETTER_AUTH_URL}${pathOrUrl}`;
  const headers = new Headers({ origin: env.WEB_ORIGIN });
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (options.cookie) headers.set('cookie', options.cookie);
  return auth.handler(
    new Request(url, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      redirect: 'manual',
    }),
  );
}

function cookieFrom(response: Response) {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

function cookiesFrom(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return (headers.getSetCookie?.() ?? [response.headers.get('set-cookie') ?? ''])
    .map((value) => value.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function totp(secret: string, now = Date.now()) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret.replace(/=+$/, '').toUpperCase())
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const key = Buffer.from(
    bits
      .match(/.{8}/g)
      ?.map((byte) => String.fromCharCode(Number.parseInt(byte, 2)))
      .join('') ?? '',
    'binary',
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, '0');
}

function linkFrom(subject: RegExp, recipient = email) {
  const message = messages.find((item) => item.to === recipient && subject.test(item.subject));
  const match = message?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`Expected captured email link for ${recipient}`);
  return match[0];
}

async function register(address: string, authGoalIntakeToken?: string) {
  return call('/api/auth/sign-up/email', {
    body: {
      email: address,
      password,
      name: 'Sprint Client',
      authFirstName: 'Sprint',
      authLastName: 'Client',
      authTimezone: 'America/New_York',
      authTermsAccepted: true,
      authGoalIntakeToken,
      callbackURL: '/login?verified=1',
    },
  });
}

async function verify(address = email) {
  const response = await call(linkFrom(/verify/i, address));
  expect(response.status).toBe(302);
  expect(response.headers.get('location')).toMatch(
    /^(http:\/\/localhost:5173)?\/login\?verified=1$/,
  );
}

async function signIn(address = email, selectedPassword = password) {
  const response = await call('/api/auth/sign-in/email', {
    body: { email: address, password: selectedPassword },
  });
  return { response, cookie: cookieFrom(response) };
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  const goalRegistrationClient = await prisma.client.findFirst({
    where: { user: { email: goalRegistrationEmail } },
  });
  if (goalRegistrationClient) {
    const goals = await prisma.clientGoal.findMany({
      where: { clientId: goalRegistrationClient.id },
      select: { id: true },
    });
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { in: goals.map(({ id }) => id) } },
    });
    await prisma.auditEvent.deleteMany({ where: { clientId: goalRegistrationClient.id } });
    await prisma.anonymousGoalIntake.deleteMany({
      where: { consumedByClientId: goalRegistrationClient.id },
    });
    await prisma.clientGoalRevision.deleteMany({ where: { clientId: goalRegistrationClient.id } });
    await prisma.clientGoal.deleteMany({ where: { clientId: goalRegistrationClient.id } });
  }
  await prisma.client.deleteMany({
    where: { user: { email: { in: [email, secondEmail, goalRegistrationEmail] } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: [email, secondEmail, staffEmail, adminEmail, goalRegistrationEmail] } },
  });
  await prisma.$disconnect();
});

describe.sequential('Better Auth client authentication', () => {
  test('disabling staff MFA invalidates current and step-up assurance', () => {
    const verifiedAt = new Date();
    expect(deriveMfaAssurance('CONSULTANT', true, verifiedAt, 15)).toEqual({
      staffMfaVerified: true,
      stepUpVerified: true,
    });
    expect(deriveMfaAssurance('CONSULTANT', false, verifiedAt, 15)).toEqual({
      staffMfaVerified: false,
      stepUpVerified: false,
    });
    expect(
      deriveMfaAssurance('ADMIN', true, new Date(Date.now() - 16 * 60_000), 15),
    ).toEqual({
      staffMfaVerified: true,
      stepUpVerified: false,
    });
  });

  test('binds a goal-first intake to a newly registered client exactly once', async () => {
    const address = goalRegistrationEmail;
    const rawToken = createHash('sha256').update(randomUUID()).digest('base64url');
    const intake = await prisma.anonymousGoalIntake.create({
      data: {
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'BOTH',
        targetAmount: 95_000,
        allowAnnualFee: true,
        cardTypePreference: 'UNSECURED_PREFERRED',
        offerPreferences: ['ZERO_APR', 'REWARDS_POINTS'],
        feePreference: 'FEE_ACCEPTABLE',
        preferenceNote: 'Travel rewards preferred.',
        firstName: 'Sprint',
        lastName: 'Client',
        email: address,
        phone: null,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    const response = await register(address, rawToken);
    expect(response.status).toBe(200);
    const created = await prisma.user.findUniqueOrThrow({
      where: { email: address },
      include: { client: { include: { goals: true, goalRevisions: true } } },
    });
    expect(created.client?.goals).toHaveLength(1);
    expect(created.client?.goalRevisions).toHaveLength(1);
    expect(created.client?.goals[0]).toMatchObject({
      scope: 'BOTH',
      cardTypePreference: 'UNSECURED_PREFERRED',
      offerPreferences: ['ZERO_APR', 'REWARDS_POINTS'],
      feePreference: 'FEE_ACCEPTABLE',
    });
    expect(await prisma.goalIntakeRegistrationClaim.count()).toBe(0);
    expect(
      await prisma.outboxEvent.count({ where: { eventKey: `goal-intake-bound:${intake.id}` } }),
    ).toBe(1);
  });

  test('enrolls seeded staff with an otpauth URI, verifies TOTP, and resets to an enrollable state', async () => {
    await prisma.user.deleteMany({ where: { email: staffEmail } });
    const passwordHash = await hashPassword(password);
    const staff = await prisma.user.create({
      data: {
        email: staffEmail,
        name: 'Sprint 4.1 Staff',
        emailVerified: true,
        passwordHash,
        role: 'CONSULTANT',
        status: 'ACTIVE',
      },
    });
    await prisma.betterAuthAccount.create({
      data: {
        issuer: 'local:credential',
        accountId: staff.id,
        userId: staff.id,
        providerId: 'credential',
        password: passwordHash,
      },
    });
    const signedIn = await signIn(staffEmail);
    expect(signedIn.response.status).toBe(200);
    const enabled = await call('/api/auth/two-factor/enable', {
      cookie: signedIn.cookie,
      body: { password },
    });
    expect(enabled.status).toBe(200);
    const enrollment = (await enabled.json()) as { totpURI: string; backupCodes: string[] };
    expect(enrollment.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(enrollment.backupCodes.length).toBeGreaterThan(0);
    const secret = new URL(enrollment.totpURI).searchParams.get('secret');
    expect(secret).toBeTruthy();
    const verified = await call('/api/auth/two-factor/verify-totp', {
      cookie: signedIn.cookie,
      body: { code: totp(secret!) },
    });
    expect(verified.status).toBe(200);
    const verifiedCookie = cookieFrom(verified) || signedIn.cookie;
    const principal = await resolveBetterAuthPrincipal(
      auth,
      prisma,
      { cookie: verifiedCookie },
      env.MFA_STEP_UP_TTL_MINUTES,
    );
    expect(principal).toMatchObject({
      userId: staff.id,
      role: 'CONSULTANT',
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    });
    expect(
      await prisma.user.findUniqueOrThrow({
        where: { id: staff.id },
        select: { twoFactorEnabled: true },
      }),
    ).toMatchObject({ twoFactorEnabled: true });

    await call('/api/auth/sign-out', { cookie: verifiedCookie, body: {} });
    const challengedSignIn = await signIn(staffEmail);
    expect(challengedSignIn.response.status).toBe(200);
    await expect(challengedSignIn.response.clone().json()).resolves.toMatchObject({
      twoFactorRedirect: true,
    });
    const invalidChallenge = await call('/api/auth/two-factor/verify-totp', {
      cookie: cookiesFrom(challengedSignIn.response),
      body: { code: '000000' },
    });
    expect([400, 401]).toContain(invalidChallenge.status);
    expect(await prisma.betterAuthSession.count({ where: { userId: staff.id } })).toBe(0);
    const verifiedChallenge = await call('/api/auth/two-factor/verify-totp', {
      cookie: cookiesFrom(challengedSignIn.response),
      body: { code: totp(secret!) },
    });
    expect(verifiedChallenge.status).toBe(200);
    const challengePrincipal = await resolveBetterAuthPrincipal(
      auth,
      prisma,
      { cookie: cookiesFrom(verifiedChallenge) },
      env.MFA_STEP_UP_TTL_MINUTES,
    );
    expect(challengePrincipal).toMatchObject({
      userId: staff.id,
      staffMfaVerified: true,
      stepUpVerified: true,
    });

    await resetReviewStaffMfa(prisma, [staff.id]);
    expect(await prisma.betterAuthTwoFactor.count({ where: { userId: staff.id } })).toBe(0);
    expect(await prisma.betterAuthSession.count({ where: { userId: staff.id } })).toBe(0);
    const resetSignIn = await signIn(staffEmail);
    const reenabled = await call('/api/auth/two-factor/enable', {
      cookie: resetSignIn.cookie,
      body: { password },
    });
    expect(reenabled.status).toBe(200);
    expect(((await reenabled.json()) as { totpURI: string }).totpURI).toMatch(
      /^otpauth:\/\/totp\//,
    );
  });

  test('gives seeded Admin the same verified QR-first enrollment and deterministic reset', async () => {
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    const passwordHash = await hashPassword(password);
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Sprint 4.1 Admin',
        emailVerified: true,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await prisma.betterAuthAccount.create({
      data: {
        issuer: 'local:credential',
        accountId: admin.id,
        userId: admin.id,
        providerId: 'credential',
        password: passwordHash,
      },
    });
    const signedIn = await signIn(adminEmail);
    const enabled = await call('/api/auth/two-factor/enable', {
      cookie: signedIn.cookie,
      body: { password },
    });
    expect(enabled.status).toBe(200);
    const enrollment = (await enabled.json()) as { totpURI: string; backupCodes: string[] };
    expect(enrollment.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(enrollment.backupCodes.length).toBeGreaterThan(0);
    const secret = new URL(enrollment.totpURI).searchParams.get('secret');
    // Characterize an already-enrolled staff account whose current authenticated
    // session still needs step-up assurance. Better Auth verifies this session
    // in place rather than creating a replacement session.
    await prisma.user.update({
      where: { id: admin.id },
      data: { twoFactorEnabled: true },
    });
    const invalid = await call('/api/auth/two-factor/verify-totp', {
      cookie: signedIn.cookie,
      body: { code: '000000' },
    });
    expect([400, 401]).toContain(invalid.status);
    expect(
      await prisma.betterAuthSession.findFirstOrThrow({
        where: { userId: admin.id },
        select: { staffMfaVerifiedAt: true },
      }),
    ).toEqual({ staffMfaVerifiedAt: null });
    const verified = await call('/api/auth/two-factor/verify-totp', {
      cookie: signedIn.cookie,
      body: { code: totp(secret!) },
    });
    expect(verified.status).toBe(200);
    const principal = await resolveBetterAuthPrincipal(
      auth,
      prisma,
      { cookie: cookieFrom(verified) || signedIn.cookie },
      env.MFA_STEP_UP_TTL_MINUTES,
    );
    expect(principal).toMatchObject({
      userId: admin.id,
      role: 'ADMIN',
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    });
    await resetReviewStaffMfa(prisma, [admin.id]);
    expect(await prisma.betterAuthTwoFactor.count({ where: { userId: admin.id } })).toBe(0);
    expect(await prisma.betterAuthSession.count({ where: { userId: admin.id } })).toBe(0);
  });
  test('registers one governed user/client/account and rejects duplicate effects', async () => {
    await register(email).then((response) => expect(response.status).toBe(200));
    await register(email).then((response) => expect(response.status).toBe(200));

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { client: true, betterAuthAccounts: true },
    });
    expect(user.role).toBe('CLIENT');
    expect(user.emailVerified).toBe(false);
    expect(user.client).toMatchObject({ firstName: 'Sprint', lastName: 'Client' });
    expect(user.betterAuthAccounts).toHaveLength(1);
    expect(user.betterAuthAccounts[0]?.providerId).toBe('credential');
    expect(
      await prisma.auditEvent.count({
        where: { actorId: user.id, action: 'AUTH_CLIENT_REGISTERED' },
      }),
    ).toBe(1);
  });

  test('requires verification and rejects an external callback target', async () => {
    await signIn().then(({ response }) => expect(response.status).toBe(403));
    await call('/api/auth/send-verification-email', {
      body: { email, callbackURL: 'https://attacker.example/steal' },
    }).then((response) => expect(response.status).toBe(403));
    const blocked = await prisma.auditEvent.findFirstOrThrow({
      where: { action: 'AUTH_RETURN_PATH_BLOCKED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(blocked.actorId).toBeNull();
    expect(blocked.metadata).toEqual({
      endpoint: '/send-verification-email',
      category: 'UNTRUSTED_RETURN_TARGET',
    });
    await verify();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(
      await prisma.auditEvent.count({
        where: { actorId: user.id, action: 'AUTH_EMAIL_VERIFIED' },
      }),
    ).toBe(1);
  });

  test('signs in, lists sessions, and revokes another session', async () => {
    const first = await signIn();
    const second = await signIn();
    expect(first.response.status).toBe(200);
    expect(second.response.status).toBe(200);
    expect(first.cookie).toBeTruthy();

    const list = await call('/api/auth/list-sessions', { cookie: first.cookie });
    const sessions = (await list.json()) as Array<{ token: string; userId: string }>;
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(
      await prisma.auditEvent.count({
        where: { actorId: sessions[0]?.userId, action: 'AUTH_SESSION_CREATED' },
      }),
    ).toBeGreaterThanOrEqual(2);
    expect(
      await prisma.auditEvent.count({
        where: { actorId: sessions[0]?.userId, action: 'AUTH_LOGIN_SUCCEEDED' },
      }),
    ).toBeGreaterThanOrEqual(2);

    const secondSession = await auth.api.getSession({
      headers: new Headers({ cookie: second.cookie }),
    });
    expect(secondSession).not.toBeNull();
    await call('/api/auth/revoke-session', {
      cookie: first.cookie,
      body: { token: secondSession?.session.token },
    }).then((response) => expect(response.status).toBe(200));
    await call('/api/auth/get-session', { cookie: second.cookie }).then((response) =>
      expect(response.status).toBe(200),
    );
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: second.cookie }) }),
    ).toBeNull();
    expect(await resolveBetterAuthPrincipal(auth, prisma, { cookie: second.cookie })).toBeNull();
    expect(
      await prisma.auditEvent.count({
        where: {
          actorId: sessions[0]?.userId,
          action: 'AUTH_SESSION_REVOKED',
          entityId: secondSession?.session.id,
        },
      }),
    ).toBe(1);
    await call('/api/auth/sign-out', { cookie: first.cookie, body: {} }).then((response) =>
      expect(response.status).toBe(200),
    );
    expect(
      await prisma.auditEvent.count({
        where: { actorId: sessions[0]?.userId, action: 'AUTH_LOGOUT' },
      }),
    ).toBeGreaterThanOrEqual(1);
  });

  test('does not disclose account existence during password reset', async () => {
    const known = await call('/api/auth/request-password-reset', {
      body: { email, redirectTo: '/reset-password' },
    });
    const missing = await call('/api/auth/request-password-reset', {
      body: { email: `missing-${suffix}@example.com`, redirectTo: '/reset-password' },
    });
    expect(known.status).toBe(200);
    expect(missing.status).toBe(200);
    expect(await known.json()).toEqual(await missing.json());
  });

  test('uses reset links once and revokes every existing session', async () => {
    const prior = await signIn();
    const resetAuditCount = await prisma.auditEvent.count({
      where: { action: 'AUTH_PASSWORD_RESET_COMPLETED' },
    });
    const resetLink = linkFrom(/reset/i);
    const callback = await call(resetLink);
    const token = new URL(callback.headers.get('location') ?? '').searchParams.get('token');
    expect(token).toBeTruthy();

    await call('/api/auth/reset-password', {
      body: { token, newPassword: 'A-New-Correct-Horse-Password-21!' },
    }).then((response) => expect(response.status).toBe(200));
    await call('/api/auth/reset-password', {
      body: { token, newPassword: 'Another-New-Password-For-21!' },
    }).then((response) => expect(response.status).toBe(400));
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: prior.cookie }) }),
    ).toBeNull();
    await signIn(email, password).then(({ response }) => expect(response.status).toBe(401));
    await signIn(email, 'A-New-Correct-Horse-Password-21!').then(({ response }) =>
      expect(response.status).toBe(200),
    );
    expect(
      await prisma.auditEvent.count({
        where: { action: 'AUTH_PASSWORD_RESET_COMPLETED' },
      }),
    ).toBe(resetAuditCount + 1);
  });

  test('does not allow one user to revoke another user session', async () => {
    await register(secondEmail);
    await verify(secondEmail);
    const first = await signIn();
    const other = await signIn(secondEmail);
    const otherSession = await auth.api.getSession({
      headers: new Headers({ cookie: other.cookie }),
    });

    await call('/api/auth/revoke-session', {
      cookie: first.cookie,
      body: { token: otherSession?.session.token },
    });
    expect(
      await auth.api.getSession({ headers: new Headers({ cookie: other.cookie }) }),
    ).not.toBeNull();
  });

  test('audits a failed login with a safe category and no submitted identity', async () => {
    const app = createApp(
      env,
      pino({ level: 'silent' }),
      undefined,
      undefined,
      undefined,
      prisma,
      undefined,
      auth,
    );
    await request(app)
      .post('/api/auth/sign-in/email')
      .set('origin', env.WEB_ORIGIN)
      .send({ email, password: 'Definitely-Wrong-Password-21!' })
      .expect(401);
    const event = await waitForAudit('AUTH_LOGIN_FAILED');
    expect(event.actorId).toBeNull();
    expect(event.metadata).toEqual({
      category: 'CREDENTIAL_OR_ACCOUNT_REJECTED',
      statusCode: 401,
    });
  });

  test('deterministically rejects the request after the configured auth limit', async () => {
    const limitedCall = () =>
      rateLimitedAuth.handler(
        new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: env.WEB_ORIGIN },
          body: JSON.stringify({
            email: `rate-${suffix}@example.com`,
            password: 'Definitely-Wrong-Password-21!',
          }),
        }),
      );
    expect((await limitedCall()).status).toBe(401);
    expect((await limitedCall()).status).toBe(401);
    const rejected = await limitedCall();
    expect(rejected.status).toBe(429);
  });
});
