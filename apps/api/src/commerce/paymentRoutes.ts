import { createHash } from 'node:crypto';
import express, { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  requireCanonicalCapability,
  requireRole,
  type AuthorizationDenialRecorder,
} from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { frozenTerms } from './domain.js';
import { PaymentGatewayRegistry, type PaymentGateway } from './paymentGateway.js';
import { applyVerifiedPaymentEvent } from './paymentService.js';
import {
  canonicalDefaultGateway,
  ensureGatewayConfigs,
  reconcilePayment,
  requestRefund,
  setDefaultGateway,
  setGatewayEnabled,
  testGatewayConnection,
  updateGatewayMetadata,
} from './paymentOperations.js';

const safePayment = (payment: {
  id: string;
  provider: string;
  providerEnvironment: string;
  state: string;
  amount: Prisma.Decimal;
  currency: string;
  checkoutUrl: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: payment.id,
  provider: payment.provider,
  environment: payment.providerEnvironment,
  state: payment.state,
  amount: payment.amount.toFixed(2),
  currency: payment.currency,
  checkoutUrl: payment.checkoutUrl,
  lastErrorCode: payment.lastErrorCode,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});
const keyFrom = (req: { get(name: string): string | undefined }) => {
  const key = req.get('Idempotency-Key');
  if (!key || key.length > 120)
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key is required');
  return key;
};

const registryFor = (source: PaymentGateway | PaymentGatewayRegistry) =>
  source instanceof PaymentGatewayRegistry
    ? source
    : new PaymentGatewayRegistry([source], source.provider);

export function createPaymentWebhookRouter(
  prisma: PrismaClient,
  gatewaySource: PaymentGateway | PaymentGatewayRegistry,
) {
  const registry = registryFor(gatewaySource);
  const router = Router();
  const webhook =
    (provider: 'PAYPAL' | 'STRIPE' | 'BOFA_MERCHANT') =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const gateway = registry.get(provider);
        const event = await gateway.verifyWebhook(req.headers, req.body);
        const result = await applyVerifiedPaymentEvent(prisma, event);
        res.status(202).json({ accepted: true, result });
      } catch (error) {
        await prisma.auditEvent
          .create({
            data: {
              action: 'PAYMENT_WEBHOOK_REJECTED',
              entityType: 'PaymentProvider',
              source: `${provider}_WEBHOOK`,
              metadata: { reason: error instanceof Error ? error.message : 'INVALID' },
            },
          })
          .catch(() => undefined);
        next(new AppError('WEBHOOK_UNVERIFIED', 401, 'Provider verification failed'));
      }
    };
  router.post('/paypal', express.json({ limit: '1mb' }), webhook('PAYPAL'));
  router.post(
    '/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    webhook('STRIPE'),
  );
  router.post(
    '/bofa',
    express.urlencoded({ extended: false, limit: '256kb' }),
    webhook('BOFA_MERCHANT'),
  );
  return router;
}

export function createPaymentRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  gatewaySource: PaymentGateway | PaymentGatewayRegistry,
  webOrigin: string,
  denialRecorder?: AuthorizationDenialRecorder,
) {
  const registry = registryFor(gatewaySource);
  const router = Router();
  router.post('/client/checkouts', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const parsed = z.object({ productId: z.string().uuid() }).strict().safeParse(req.body);
      if (!parsed.success)
        throw new AppError(
          'INVALID_CHECKOUT_REQUEST',
          400,
          'Only a canonical service product may be selected',
        );
      const { productId } = parsed.data;
      const { gateway } = await canonicalDefaultGateway(prisma, registry);
      const idempotencyKey = keyFrom(req);
      const product = await prisma.serviceProduct.findFirst({
        where: { id: productId, active: true },
        include: {
          versions: { where: { status: 'ACTIVE' }, orderBy: { version: 'desc' }, take: 1 },
        },
      });
      const version = product?.versions[0];
      if (!product || !version || product.currentVersion !== version.version)
        throw new AppError(
          'PRODUCT_NOT_AVAILABLE',
          409,
          'This service is no longer available for checkout',
        );
      const health = await gateway.health();
      if (!health.healthy)
        throw new AppError(
          'PAYMENT_PROVIDER_UNAVAILABLE',
          503,
          'Checkout is temporarily unavailable',
        );
      const requestHash = createHash('sha256')
        .update(JSON.stringify({ productId, version: version.version }))
        .digest('hex');
      const command = await executeConsequentialCommand<{ purchaseId: string; paymentId: string }>(
        prisma,
        {
          idempotency: {
            scope: 'client-checkout',
            subjectId: req.auth!.clientId!,
            operation: 'create',
            key: idempotencyKey,
            requestHash,
          },
          audit: (result) => ({
            actorId: req.auth!.userId,
            clientId: req.auth!.clientId,
            action: 'PAYMENT_CHECKOUT_CREATED',
            entityType: 'Payment',
            entityId: result.paymentId,
          }),
          outbox: {
            eventType: 'commerce.checkout.created',
            eventKey: `checkout-created:${req.auth!.clientId}:${idempotencyKey}`,
            aggregateType: 'ServicePurchase',
            aggregateId: (result) => result.purchaseId,
            payload: (result) => ({
              clientId: req.auth!.clientId!,
              purchaseId: result.purchaseId,
              paymentId: result.paymentId,
              domains: ['services', 'payments'],
            }),
          },
          mutate: async (tx) => {
            const purchase = await tx.servicePurchase.create({
              data: {
                clientId: req.auth!.clientId!,
                serviceType: version.entitlementType,
                productVersionId: version.id,
                termsSnapshot: frozenTerms(product.key, {
                  ...version,
                  entitlementType: version.entitlementType!,
                }),
                amount: version.price,
                currency: version.currency,
                paymentProvider: gateway.provider,
              },
            });
            const payment = await tx.payment.create({
              data: {
                clientId: req.auth!.clientId!,
                purchaseId: purchase.id,
                provider: gateway.provider,
                providerEnvironment: gateway.environment,
                amount: version.price,
                currency: version.currency,
              },
            });
            return { purchaseId: purchase.id, paymentId: payment.id };
          },
        },
      );
      let payment = await prisma.payment.findUniqueOrThrow({
        where: { id: command.result.paymentId },
      });
      if (!payment.providerOrderId) {
        try {
          const checkout = await gateway.createCheckout({
            paymentId: payment.id,
            purchaseId: command.result.purchaseId,
            amount: payment.amount.toFixed(2),
            currency: payment.currency,
            description: version.name,
            returnUrl: `${webOrigin}/app/checkout/${command.result.purchaseId}?returned=1`,
            cancelUrl: `${webOrigin}/app/checkout/${command.result.purchaseId}?cancelled=1`,
          });
          payment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
              providerOrderId: checkout.providerOrderId,
              checkoutUrl: checkout.checkoutUrl,
              state: 'AWAITING_CUSTOMER',
              lastErrorCode: null,
            },
          });
        } catch {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { lastErrorCode: 'PROVIDER_CHECKOUT_UNAVAILABLE' },
          });
          throw new AppError(
            'PAYMENT_PROVIDER_UNAVAILABLE',
            503,
            'Checkout is temporarily unavailable',
          );
        }
      }
      res.status(command.replayed ? 200 : 201).json({
        purchaseId: command.result.purchaseId,
        payment: safePayment(payment),
        replayed: command.replayed,
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/checkouts/:purchaseId', requireRole('CLIENT'), async (req, res, next) => {
    try {
      let payment = await prisma.payment.findFirst({
        where: { purchaseId: req.params.purchaseId as string, clientId: req.auth!.clientId! },
        include: { purchase: { include: { entitlements: true, reviewCreditTransactions: true } } },
      });
      if (!payment) throw new AppError('NOT_FOUND', 404, 'Checkout was not found');
      if (
        payment.providerOrderId &&
        !['SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(payment.state)
      ) {
        try {
          const gateway = registry.get(payment.provider);
          await applyVerifiedPaymentEvent(prisma, await gateway.retrieve(payment.providerOrderId));
          payment = await prisma.payment.findFirstOrThrow({
            where: { id: payment.id },
            include: {
              purchase: { include: { entitlements: true, reviewCreditTransactions: true } },
            },
          });
        } catch {
          /* status remains safely pending */
        }
      }
      res.json({
        purchase: {
          id: payment.purchase.id,
          status: payment.purchase.status,
          terms: payment.purchase.termsSnapshot,
          effectsGranted:
            payment.purchase.entitlements.length > 0 ||
            payment.purchase.reviewCreditTransactions.length > 0,
        },
        payment: safePayment(payment),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/client/checkouts/:purchaseId/launch',
    requireRole('CLIENT'),
    async (req, res, next) => {
      try {
        const payment = await prisma.payment.findFirst({
          where: { purchaseId: req.params.purchaseId as string, clientId: req.auth!.clientId! },
          include: { purchase: { include: { productVersion: true } } },
        });
        if (!payment) throw new AppError('NOT_FOUND', 404, 'Checkout was not found');
        if (payment.provider !== 'BOFA_MERCHANT')
          throw new AppError('INVALID_CHECKOUT_PROVIDER', 409, 'Hosted form is not required');
        const gateway = registry.get(payment.provider);
        const health = await gateway.health();
        if (!health.healthy)
          throw new AppError(
            'PAYMENT_PROVIDER_UNAVAILABLE',
            503,
            'Checkout is temporarily unavailable',
          );
        const checkout = await gateway.createCheckout({
          paymentId: payment.id,
          purchaseId: payment.purchaseId,
          amount: payment.amount.toFixed(2),
          currency: payment.currency,
          description: payment.purchase.productVersion?.name ?? 'Credit Consulting service',
          returnUrl: `${webOrigin}/app/checkout/${payment.purchaseId}?returned=1`,
          cancelUrl: `${webOrigin}/app/checkout/${payment.purchaseId}?cancelled=1`,
        });
        if (checkout.method !== 'POST' || !checkout.formFields)
          throw new AppError('INVALID_CHECKOUT_PROVIDER', 409, 'Hosted form is not available');
        res.json({
          action: checkout.checkoutUrl,
          method: checkout.method,
          fields: checkout.formFields,
        });
      } catch (error) {
        next(error);
      }
    },
  );
  const adminGate = [
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'payment.read',
      { requireStepUp: true },
      denialRecorder,
    ),
  ];
  const adminManageGate = [
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'payment.manage',
      { requireStepUp: true },
      denialRecorder,
    ),
  ];
  router.get('/admin/payment-gateways', ...adminGate, async (_req, res, next) => {
    try {
      await ensureGatewayConfigs(prisma, registry);
      const configs = await prisma.paymentGatewayConfig.findMany({ orderBy: { provider: 'asc' } });
      res.json({ gateways: configs });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/admin/payment-gateways/:provider/default',
    ...adminManageGate,
    async (req, res, next) => {
      try {
        const provider = z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT']).parse(req.params.provider);
        res.json({ gateway: await setDefaultGateway(prisma, provider, req.auth!.userId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.post(
    '/admin/payment-gateways/:provider/enabled',
    ...adminManageGate,
    async (req, res, next) => {
      try {
        const provider = z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT']).parse(req.params.provider);
        const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(req.body);
        res.json({ gateway: await setGatewayEnabled(prisma, provider, enabled, req.auth!.userId) });
      } catch (error) {
        next(error);
      }
    },
  );
  router.patch('/admin/payment-gateways/:provider', ...adminManageGate, async (req, res, next) => {
    try {
      const provider = z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT']).parse(req.params.provider);
      const metadata = z
        .object({
          displayName: z.string().max(80).optional(),
          accountReference: z.string().max(120).optional(),
        })
        .strict()
        .parse(req.body);
      res.json({
        gateway: await updateGatewayMetadata(
          prisma,
          provider,
          {
            ...(metadata.displayName ? { displayName: metadata.displayName } : {}),
            ...(metadata.accountReference ? { accountReference: metadata.accountReference } : {}),
          },
          req.auth!.userId,
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/payments', ...adminGate, async (req, res, next) => {
    try {
      const input = z
        .object({
          state: z.string().optional(),
          provider: z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT', 'MANUAL', 'OTHER']).optional(),
          clientId: z.string().uuid().optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          search: z.string().max(120).default(''),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const where: Prisma.PaymentWhereInput = {
        ...(input.state ? { state: input.state as never } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.clientId ? { clientId: input.clientId } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
        ...(input.search
          ? {
              OR: [
                { providerOrderId: { contains: input.search, mode: 'insensitive' } },
                { providerPaymentId: { contains: input.search, mode: 'insensitive' } },
                {
                  client: {
                    OR: [
                      { firstName: { contains: input.search, mode: 'insensitive' } },
                      { lastName: { contains: input.search, mode: 'insensitive' } },
                    ],
                  },
                },
                {
                  purchase: {
                    productVersion: { name: { contains: input.search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      };
      const [total, payments] = await prisma.$transaction([
        prisma.payment.count({ where }),
        prisma.payment.findMany({
          where,
          include: {
            client: { select: { firstName: true, lastName: true } },
            purchase: { select: { termsSnapshot: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({
        total,
        page: input.page,
        pageSize: input.pageSize,
        payments: payments.map((payment) => ({
          ...safePayment(payment),
          client: payment.client,
          terms: payment.purchase.termsSnapshot,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/refunds', ...adminGate, async (req, res, next) => {
    try {
      const input = z
        .object({
          status: z
            .enum(['REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])
            .optional(),
          provider: z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT']).optional(),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const where: Prisma.PaymentRefundWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
      };
      const [total, refunds] = await prisma.$transaction([
        prisma.paymentRefund.count({ where }),
        prisma.paymentRefund.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({ total, page: input.page, pageSize: input.pageSize, refunds });
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/disputes', ...adminGate, async (req, res, next) => {
    try {
      const input = z
        .object({
          status: z.enum(['OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED']).optional(),
          provider: z.enum(['PAYPAL', 'STRIPE', 'BOFA_MERCHANT']).optional(),
          page: z.coerce.number().int().positive().default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const where: Prisma.PaymentDisputeWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.provider ? { provider: input.provider } : {}),
      };
      const [total, disputes] = await prisma.$transaction([
        prisma.paymentDispute.count({ where }),
        prisma.paymentDispute.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({ total, page: input.page, pageSize: input.pageSize, disputes });
    } catch (error) {
      next(error);
    }
  });
  router.get('/admin/payments/:paymentId', ...adminGate, async (req, res, next) => {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: req.params.paymentId as string },
        include: {
          purchase: { include: { entitlements: true, reviewCreditTransactions: true } },
          providerEvents: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
          refunds: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
          disputes: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
          reconciliationAttempts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
        },
      });
      if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment was not found');
      res.json({
        payment: safePayment(payment),
        purchase: payment.purchase,
        events: payment.providerEvents,
        refunds: payment.refunds,
        disputes: payment.disputes,
        reconciliations: payment.reconciliationAttempts,
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/payments/:paymentId/refunds', ...adminManageGate, async (req, res, next) => {
    try {
      const input = z
        .object({
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
          reason: z.string().max(500).optional(),
        })
        .strict()
        .parse(req.body);
      const refund = await requestRefund(prisma, registry, {
        paymentId: req.params.paymentId as string,
        amount: input.amount,
        ...(input.reason ? { reason: input.reason } : {}),
        actorId: req.auth!.userId,
        idempotencyKey: keyFrom(req),
      });
      res.status(201).json({ refund });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/admin/payments/:paymentId/reconcile',
    ...adminManageGate,
    async (req, res, next) => {
      try {
        const attempt = await reconcilePayment(prisma, registry, {
          paymentId: req.params.paymentId as string,
          actorId: req.auth!.userId,
          idempotencyKey: keyFrom(req),
        });
        res.json({ reconciliation: attempt });
      } catch (error) {
        next(error);
      }
    },
  );
  router.get('/admin/integrations/paypal', ...adminGate, async (_req, res) =>
    res.json({ gateway: await registry.get('PAYPAL').health() }),
  );
  router.post(
    '/admin/integrations/paypal/test',
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'payment.manage',
      { requireStepUp: true },
      denialRecorder,
    ),
    async (req, res) =>
      res.json({
        ...(await testGatewayConnection(prisma, registry, 'PAYPAL', req.auth!.userId)),
        testedBy: req.auth!.userId,
      }),
  );
  router.get('/admin/integrations/bofa', ...adminGate, async (_req, res) =>
    res.json({ gateway: await registry.get('BOFA_MERCHANT').health() }),
  );
  router.post(
    '/admin/integrations/bofa/test',
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'payment.manage',
      { requireStepUp: true },
      denialRecorder,
    ),
    async (req, res) =>
      res.json({
        ...(await testGatewayConnection(prisma, registry, 'BOFA_MERCHANT', req.auth!.userId)),
        testedBy: req.auth!.userId,
      }),
  );
  router.get('/admin/integrations/stripe', ...adminGate, async (_req, res) =>
    res.json({ gateway: await registry.get('STRIPE').health() }),
  );
  router.post(
    '/admin/integrations/stripe/test',
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'payment.manage',
      { requireStepUp: true },
      denialRecorder,
    ),
    async (req, res) =>
      res.json({
        ...(await testGatewayConnection(prisma, registry, 'STRIPE', req.auth!.userId)),
        testedBy: req.auth!.userId,
      }),
  );
  return router;
}
