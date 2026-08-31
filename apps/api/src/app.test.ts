import pino from 'pino';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/credit_strategy_test',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:5173',
});
const app = createApp(env, pino({ level: 'silent' }));

describe('API foundation', () => {
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
