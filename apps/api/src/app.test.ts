import pino from 'pino';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import express from 'express';
import { createApp, createHttpLogger, httpLogRedact } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/credit_strategy_test',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:5173',
});
const app = createApp(env, pino({ level: 'silent' }));

describe('API foundation', () => {
  test('configures HTTP-boundary credential redaction', () => {
    expect(httpLogRedact).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
      ]),
    );
  });
  test('never serializes credential-bearing request or response header values', async () => {
    const authorizationSecret = 'wave0-authorization-secret';
    const cookieSecret = 'wave0-cookie-secret';
    const responseCookieSecret = 'wave0-response-cookie-secret';
    const chunks: string[] = [];
    const loggingApp = express();
    loggingApp.use(
      createHttpLogger('info', {
        write(chunk) {
          chunks.push(chunk.toString());
        },
      }),
    );
    loggingApp.get('/credential-redaction-proof', (_req, res) => {
      res.setHeader('set-cookie', `session=${responseCookieSecret}; HttpOnly; Secure`);
      res.json({ status: 'ok' });
    });

    await request(loggingApp)
      .get('/credential-redaction-proof')
      .set('authorization', `Bearer ${authorizationSecret}`)
      .set('cookie', `session=${cookieSecret}`)
      .expect(200);

    const serializedLogs = chunks.join('');
    expect(serializedLogs).not.toContain(authorizationSecret);
    expect(serializedLogs).not.toContain(cookieSecret);
    expect(serializedLogs).not.toContain(responseCookieSecret);
    expect(serializedLogs).not.toContain('Bearer ');
    expect(serializedLogs).toContain('[Redacted]');
  });
  test('reports health', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('reports dependency readiness separately from process health', async () => {
    const ready = createApp(
      env,
      pino({ level: 'silent' }),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        postgresql: async () => undefined,
        redis: async () => undefined,
      },
    );
    await request(ready)
      .get('/ready')
      .expect(200, {
        status: 'ready',
        dependencies: { postgresql: 'ready', redis: 'ready' },
      });

    const unavailable = createApp(
      env,
      pino({ level: 'silent' }),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        postgresql: async () => undefined,
        redis: async () => {
          throw new Error('offline');
        },
      },
    );
    await request(unavailable).get('/health').expect(200, { status: 'ok' });
    await request(unavailable)
      .get('/ready')
      .expect(503, {
        status: 'not_ready',
        dependencies: { postgresql: 'ready', redis: 'unavailable' },
      });
  });
  test('serializes unexpected errors safely', async () => {
    const response = await request(app).get('/errors/test').expect(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).not.toMatch(/deliberate/i);
    expect(response.body.error.requestId).toBeTruthy();
  });
  test('returns a stable missing route error', async () => {
    const response = await request(app).get('/missing').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('production configuration safety', () => {
  test('rejects silent console-only password-reset delivery in production', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEB_ORIGIN: 'https://app.example.com',
        EMAIL_PROVIDER: 'CONSOLE',
      }),
    ).toThrow(/outbound email provider/i);
  });
});
