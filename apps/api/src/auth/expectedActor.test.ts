import express from 'express';
import request from 'supertest';
import pino from 'pino';
import { expect, test, vi } from 'vitest';
import { requireExpectedActor } from './middleware.js';
import { errorHandler } from '../http/errors.js';

test.each(['get', 'post', 'delete'] as const)(
  'a mismatched account cannot reach a %s operation',
  async (method) => {
    const execute = vi.fn();
    const app = express();
    app.use((req, _res, next) => {
      req.auth = {
        userId: 'current-account',
        clientId: 'client',
        email: 'synthetic@example.test',
        role: 'CLIENT',
        status: 'ACTIVE',
      };
      next();
    });
    app.use(requireExpectedActor);
    app.use((_req, res) => {
      execute();
      res.json({ ok: true });
    });
    app.use(errorHandler(pino({ enabled: false })));
    const response = await request(app)
      [method]('/operation')
      .set('X-Credit-Actor', 'old-account')
      .expect(409);
    expect(response.body.error.code).toBe('SESSION_ACTOR_CHANGED');
    expect(execute).not.toHaveBeenCalled();
    await request(app)[method]('/operation').set('X-Credit-Actor', 'current-account').expect(200);
    expect(execute).toHaveBeenCalledOnce();
  },
);

test('the expectation never authenticates an anonymous caller', async () => {
  const app = express();
  app.use(requireExpectedActor);
  app.use((_req, res) => res.sendStatus(204));
  app.use(errorHandler(pino({ enabled: false })));
  await request(app).post('/operation').set('X-Credit-Actor', 'claimed-account').expect(401);
  await request(app).get('/operation').expect(204); // Legacy omission still reaches downstream authorization.
});
