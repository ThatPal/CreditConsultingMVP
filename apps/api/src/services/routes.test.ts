import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';
import { errorHandler } from '../http/errors.js';
import { createServiceRouter } from './routes.js';
import type { ServiceCatalog } from './service.js';
const clientId = '10000000-0000-4000-8000-000000000001';
function appFor(services: ServiceCatalog) {
  const app = express();
  app.use((req, _res, next) => {
    const role = req.get('x-test-role');
    if (role)
      req.auth = {
        userId: 'user',
        email: 'client@example.com',
        role: role as 'CLIENT' | 'CONSULTANT',
        status: 'ACTIVE',
        clientId: role === 'CLIENT' ? clientId : null,
      };
    next();
  });
  app.use('/api/services', createServiceRouter(services));
  app.use(errorHandler(pino({ level: 'silent' })));
  return app;
}
describe('services authorization', () => {
  const services = {
    getClientServices: vi.fn(async () => ({ catalog: [], purchases: [], reviewPlans: [] })),
  } as unknown as ServiceCatalog;
  test('requires a client session', async () => {
    const app = appFor(services);
    await request(app).get('/api/services').expect(401);
    await request(app).get('/api/services').set('x-test-role', 'CONSULTANT').expect(403);
  });
  test('scopes history to authenticated client', async () => {
    await request(appFor(services))
      .get('/api/services?clientId=other')
      .set('x-test-role', 'CLIENT')
      .expect(200);
    expect(services.getClientServices).toHaveBeenCalledWith(clientId);
  });
});
