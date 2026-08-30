import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { z } from 'zod';
import { AppError } from '../http/errors.js';
import type { ServiceCatalog } from './service.js';
export function createServiceRouter(services: ServiceCatalog) {
  const router = Router();
  router.use(requireAuth);
  router.get('/', requireRole('CLIENT'), async (req, res, next) => {
    try {
      res.json(await services.getClientServices(req.auth!.clientId!));
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/definitions', requireRole('ADMIN'), async (_req, res, next) => {
    try {
      res.json({ services: await services.listDefinitions() });
    } catch (error) {
      next(error);
    }
  });
  router.patch('/admin/definitions/:serviceType', requireRole('ADMIN'), async (req, res, next) => {
    try {
      const serviceType = z.enum(['CREDIT_PROFILE_REVIEW', 'CREDIT_CARD_ROUND', 'MAJOR_APPLICATION_READINESS']).safeParse(req.params.serviceType);
      const body = z.object({ price: z.number().min(0).max(100000), active: z.boolean() }).safeParse(req.body);
      if (!serviceType.success || !body.success) throw new AppError('VALIDATION_ERROR', 400, 'Enter a valid service price and status');
      res.json({ service: await services.updateDefinition(serviceType.data, body.data.price, body.data.active) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
