import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { errorHandler } from '../http/errors.js';
import { createGoalRouter } from './routes.js';
import type { GoalService } from './service.js';

const record = {
  id: '20000000-0000-4000-8000-000000000001',
  clientId: '10000000-0000-4000-8000-000000000001',
  goalType: 'TOTAL_AVAILABLE_CREDIT' as const,
  scope: 'PERSONAL' as const,
  targetAmount: 50000,
  currentAmount: null,
  version: 1,
  allowAnnualFee: false,
  priority: 'PRIMARY' as const,
  status: 'ACTIVE' as const,
  achievedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function appFor(goals: GoalService) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role)
      req.auth = {
        userId: 'user-1',
        email: 'person@example.com',
        role: role as 'CLIENT' | 'CONSULTANT',
        status: 'ACTIVE',
        clientId: role === 'CLIENT' ? record.clientId : null,
      };
    next();
  });
  app.use('/api/goals', createGoalRouter(goals));
  app.use(errorHandler(pino({ level: 'silent' })));
  return app;
}
describe('goal route authorization', () => {
  const service = {
    list: vi.fn(async () => [record]),
    create: vi.fn(async () => record),
    update: vi.fn(async () => record),
    archive: vi.fn(async () => record),
  } as unknown as GoalService;
  test('rejects unauthenticated and consultant access', async () => {
    const app = appFor(service);
    await request(app).get('/api/goals').expect(401);
    await request(app).get('/api/goals').set('x-test-role', 'CONSULTANT').expect(403);
  });
  test('uses authenticated client ownership scope', async () => {
    const app = appFor(service);
    await request(app)
      .get('/api/goals?clientId=someone-else')
      .set('x-test-role', 'CLIENT')
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(record.clientId);
  });

  test('requires an idempotency key and derives mutation ownership from the session', async () => {
    const app = appFor(service);
    const body = {
      goalType: 'TOTAL_AVAILABLE_CREDIT',
      scope: 'PERSONAL',
      targetAmount: 50_000,
      priority: 'PRIMARY',
    };
    await request(app).post('/api/goals').set('x-test-role', 'CLIENT').send(body).expect(400);
    await request(app)
      .post('/api/goals?clientId=someone-else')
      .set('x-test-role', 'CLIENT')
      .set('Idempotency-Key', 'goal-route-test')
      .send(body)
      .expect(201);
    expect(service.create).toHaveBeenLastCalledWith(
      record.clientId,
      expect.objectContaining(body),
      expect.objectContaining({ actorId: 'user-1', idempotencyKey: 'goal-route-test' }),
    );
  });
});
