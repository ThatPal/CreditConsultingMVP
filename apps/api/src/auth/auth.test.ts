import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../app.js';
import { loadEnv } from '../config/env.js';
import { errorHandler } from '../http/errors.js';
import { createAuthService, type ResetNotifier } from './authService.js';
import { requireClientAccess, requireRole } from './middleware.js';
import { createAuthorizationService } from '../authorization/authorizationService.js';
import type { AuthPrincipal, AuthStore, PublicUser, SessionRecord } from './types.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/credit_strategy_test',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:5173',
});

class MemoryAuthStore implements AuthStore {
  users = new Map<
    string,
    {
      id: string;
      email: string;
      passwordHash: string | null;
      role: 'CLIENT' | 'CONSULTANT' | 'ADMIN';
      status: 'ACTIVE' | 'DISABLED' | 'INVITED';
      client: { id: string } | null;
    }
  >();
  profiles = new Map<string, PublicUser>();
  sessions = new Map<string, SessionRecord>();
  resets = new Map<string, { userId: string; expiresAt: Date; usedAt: Date | null }>();
  assigned = new Map<string, string>();
  receivedGoals: Array<{ goalType: string; priority: string }> = [];
  sequence = 0;

  findUserByEmail(email: string) {
    return Promise.resolve([...this.users.values()].find((user) => user.email === email) ?? null);
  }
  async createClientUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    timezone: string;
    goals?: Array<{ goalType: string; priority: string }>;
  }) {
    this.receivedGoals = input.goals ?? [];
    const userId = `00000000-0000-4000-8000-${String(++this.sequence).padStart(12, '0')}`;
    const clientId = `10000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
    const principal: AuthPrincipal = {
      userId,
      clientId,
      email: input.email,
      role: 'CLIENT',
      status: 'ACTIVE',
    };
    this.users.set(userId, {
      id: userId,
      email: input.email,
      passwordHash: input.passwordHash,
      role: 'CLIENT',
      status: 'ACTIVE',
      client: { id: clientId },
    });
    this.profiles.set(userId, {
      ...principal,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
      timezone: input.timezone,
    });
    return principal;
  }
  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const user = this.users.get(input.userId)!;
    this.sessions.set(input.tokenHash, {
      expiresAt: input.expiresAt,
      revokedAt: null,
      principal: {
        userId: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        clientId: user.client?.id ?? null,
      },
    });
  }
  findSession(tokenHash: string) {
    return Promise.resolve(this.sessions.get(tokenHash) ?? null);
  }
  async revokeSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = new Date();
  }
  async revokeAllSessions(userId: string) {
    for (const session of this.sessions.values())
      if (session.principal.userId === userId) session.revokedAt = new Date();
  }
  markLogin() {
    return Promise.resolve();
  }
  getPublicUser(userId: string) {
    return Promise.resolve(this.profiles.get(userId) ?? null);
  }
  async updateClientProfile(
    userId: string,
    input: { firstName?: string; lastName?: string; phone?: string | null; timezone?: string },
  ) {
    const profile = this.profiles.get(userId)!;
    const updated = { ...profile, ...input };
    this.profiles.set(userId, updated);
    return updated;
  }
  canAccessClient(principal: AuthPrincipal, clientId: string) {
    return Promise.resolve(
      principal.role === 'ADMIN' ||
        (principal.role === 'CLIENT'
          ? principal.clientId === clientId
          : this.assigned.get(clientId) === principal.userId),
    );
  }
  async replacePasswordResetToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.resets.clear();
    this.resets.set(input.tokenHash, {
      userId: input.userId,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
  }
  async consumePasswordResetToken(tokenHash: string, passwordHash: string, now: Date) {
    const reset = this.resets.get(tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt <= now) return null;
    reset.usedAt = now;
    this.users.get(reset.userId)!.passwordHash = passwordHash;
    await this.revokeAllSessions(reset.userId);
    return reset.userId;
  }
}

describe('authentication and authorization', () => {
  let store: MemoryAuthStore;
  let resetUrl = '';
  let auth: ReturnType<typeof createAuthService>;
  beforeEach(() => {
    store = new MemoryAuthStore();
    const notifier: ResetNotifier = async (message) => {
      resetUrl = message.resetUrl;
    };
    auth = createAuthService(store, env, notifier);
  });

  test('AT-AUTH-01/02 registers one normalized client identity and rejects duplicate email', async () => {
    const app = createApp(env, pino({ level: 'silent' }), auth);
    const agent = request.agent(app);
    const body = {
      email: ' New.Client@Example.COM ',
      password: 'correct horse battery staple',
      firstName: 'New',
      lastName: 'Client',
      timezone: 'America/New_York',
      termsAccepted: true,
      goals: [
        {
          goalType: 'TOTAL_AVAILABLE_CREDIT',
          scope: 'PERSONAL',
          targetAmount: 50_000,
          priority: 'PRIMARY',
        },
      ],
    };
    const created = await agent.post('/api/auth/register').send(body).expect(201);
    expect(created.body.user).toMatchObject({ email: 'new.client@example.com', role: 'CLIENT' });
    expect(created.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(created.headers['set-cookie'][0]).toContain('Path=/');
    expect(created.headers['set-cookie'][0]).toContain('SameSite=Strict');
    await request(app)
      .post('/api/auth/register')
      .send(body)
      .expect(409)
      .expect(({ body: response }) => expect(response.error.code).toBe('EMAIL_ALREADY_EXISTS'));
    expect(store.users.size).toBe(1);
    expect(store.receivedGoals).toEqual([
      {
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: 50_000,
        priority: 'PRIMARY',
      },
    ]);
  });

  test('AT-AUTH-03 protects me, authenticates cookie, patches own profile, and logs out', async () => {
    const app = createApp(env, pino({ level: 'silent' }), auth);
    const agent = request.agent(app);
    await request(app)
      .get('/api/me')
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe('AUTH_REQUIRED'));
    await agent
      .post('/api/auth/register')
      .send({
        email: 'client@example.com',
        password: 'correct horse battery staple',
        firstName: 'A',
        lastName: 'Client',
        timezone: 'America/New_York',
        termsAccepted: true,
      })
      .expect(201);
    await agent
      .get('/api/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.firstName).toBe('A');
        expect(body.user.capabilities).toEqual([]);
      });
    await agent
      .patch('/api/me')
      .send({ firstName: 'Updated' })
      .expect(200)
      .expect(({ body }) => expect(body.user.firstName).toBe('Updated'));
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/me').expect(401);
  });

  test('password reset is non-enumerating, single-use, and revokes existing sessions', async () => {
    const app = createApp(env, pino({ level: 'silent' }), auth);
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({
        email: 'reset@example.com',
        password: 'correct horse battery staple',
        firstName: 'Reset',
        lastName: 'Client',
        timezone: 'America/New_York',
        termsAccepted: true,
      })
      .expect(201);
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'missing@example.com' })
      .expect(202);
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(202);
    const token = new URL(resetUrl).searchParams.get('token')!;
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'a different secure passphrase' })
      .expect(204);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'another different passphrase' })
      .expect(400);
    await agent.get('/api/me').expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'a different secure passphrase' })
      .expect(200);
  });

  test('AT-AUTH-04/05 enforces roles and client ownership server-side', async () => {
    const principal: AuthPrincipal = {
      userId: 'consultant-a',
      email: 'a@example.com',
      role: 'CONSULTANT',
      status: 'ACTIVE',
      clientId: null,
      staffMfaEnabled: true,
      staffMfaVerified: true,
      stepUpVerified: true,
    };
    store.assigned.set('client-a', principal.userId);
    const authorization = createAuthorizationService({
      hasRoleCapability: async (_role, capability) => capability === 'client.read',
      hasActiveAssignment: async (userId, clientId) => store.assigned.get(clientId) === userId,
      hasActiveGrant: async () => false,
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = principal;
      next();
    });
    app.get('/consultant', requireRole('CONSULTANT', 'ADMIN'), (_req, res) =>
      res.json({ ok: true }),
    );
    app.get('/clients/:clientId', requireClientAccess(authorization), (_req, res) =>
      res.json({ ok: true }),
    );
    app.use(errorHandler(pino({ level: 'silent' })));
    await request(app).get('/consultant').expect(200);
    await request(app).get('/clients/client-a').expect(200);
    await request(app)
      .get('/clients/client-b')
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe('FORBIDDEN'));
  });
});
