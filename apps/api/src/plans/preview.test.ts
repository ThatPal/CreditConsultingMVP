import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createPlanRouter } from './routes.js';
import { errorHandler } from '../http/errors.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
const authorize = vi.fn(async (_auth, _capability, scope) => scope.clientId === 'allowed');
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  if (req.get('x-role'))
    req.auth = {
      userId: 'staff',
      email: 'staff@example.com',
      role: req.get('x-role') as 'CONSULTANT',
      status: 'ACTIVE',
      clientId: null,
    };
  next();
});
app.use(createPlanRouter({} as PrismaClient, { authorize } as unknown as AuthorizationService));
app.use(errorHandler(pino({ level: 'silent' })));
const path = '/consultant/clients/allowed/plan/response-preview';
test('preview enforces authentication, role and client access', async () => {
  await request(app).post(path).send({ items: [] }).expect(401);
  await request(app).post(path).set('x-role', 'CLIENT').send({ items: [] }).expect(403);
  await request(app)
    .post(path.replace('allowed', 'denied'))
    .set('x-role', 'CONSULTANT')
    .send({ items: [] })
    .expect(403);
});
test('uses client schema interpretation and default report fields without database writes', async () => {
  const result = await request(app)
    .post(path)
    .set('x-role', 'CONSULTANT')
    .send({
      items: [
        { stableKey: 'report', completionMode: 'CLIENT_REPORT_CONSULTANT_VERIFY' },
        {
          stableKey: 'bad',
          completionMode: 'STRUCTURED_OUTCOME',
          outcomeSchema: { type: 'array' },
        },
      ],
    })
    .expect(200);
  expect(result.body.items[0].fields[0]).toMatchObject({
    key: 'clientReport',
    required: true,
    maxLength: 2000,
  });
  expect(result.body.items[1].error).toContain('configure');
});
