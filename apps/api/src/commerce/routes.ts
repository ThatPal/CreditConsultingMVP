import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthorizationDenialRecorder } from '../auth/middleware.js';
import {
  requireCanonicalCapability,
  requireClientAccess,
  requireRole,
} from '../auth/middleware.js';
import type { AuthorizationService } from '../authorization/authorizationService.js';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';
import { validateActivatableProduct } from './domain.js';
import type { PaymentGateway } from './paymentGateway.js';

const serviceTypes = [
  'CREDIT_PROFILE_REVIEW',
  'CREDIT_CARD_ROUND',
  'MAJOR_APPLICATION_READINESS',
] as const;
const termsInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(1200),
    price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase()),
    entitlementType: z.enum(serviceTypes),
    includedQuantity: z.number().int().min(1).max(1000),
    includedReviewCredits: z.number().int().min(0).max(1000),
    prerequisiteCode: z.string().trim().max(120).nullable().optional(),
    clientEligibilityCopy: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

function idempotencyKey(req: { get(name: string): string | undefined }) {
  const value = req.get('Idempotency-Key');
  if (!value || value.length > 120)
    throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 400, 'A valid Idempotency-Key is required');
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

type CreatedProduct = { productId: string; versionId: string };
type CreatedVersion = CreatedProduct & { version: number };

function versionData(body: z.infer<typeof termsInput>) {
  return {
    name: body.name,
    description: body.description,
    price: new Prisma.Decimal(body.price),
    currency: body.currency,
    entitlementType: body.entitlementType,
    includedQuantity: body.includedQuantity,
    includedReviewCredits: body.includedReviewCredits,
    prerequisiteCode: body.prerequisiteCode ?? null,
    clientEligibilityCopy: body.clientEligibilityCopy ?? null,
  };
}

async function clientCommerce(
  prisma: PrismaClient,
  clientId: string,
  options: { entitlementPage?: number; transactionPage?: number; pageSize?: number } = {},
) {
  const entitlementPage = options.entitlementPage ?? 1;
  const transactionPage = options.transactionPage ?? 1;
  const pageSize = options.pageSize ?? 20;
  const [entitlements, transactions, purchases, entitlementTotal, transactionTotal, balanceTotals] =
    await Promise.all([
      prisma.serviceEntitlement.findMany({
        where: { clientId },
        include: {
          productVersion: { include: { serviceProduct: { select: { key: true } } } },
          purchase: { select: { id: true, createdAt: true } },
        },
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
        skip: (entitlementPage - 1) * pageSize,
        take: pageSize,
      }),
      prisma.reviewCreditTransaction.findMany({
        where: { clientId },
        include: { productVersion: { select: { name: true, version: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (transactionPage - 1) * pageSize,
        take: pageSize,
      }),
      prisma.servicePurchase.findMany({
        where: { clientId },
        include: {
          productVersion: { include: { serviceProduct: { select: { key: true } } } },
          entitlements: { select: { id: true, status: true, quantityGranted: true } },
          reviewCreditTransactions: { select: { availableDelta: true } },
          payments: {
            select: { provider: true, providerEnvironment: true, state: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
      }),
      prisma.serviceEntitlement.count({ where: { clientId } }),
      prisma.reviewCreditTransaction.count({ where: { clientId } }),
      prisma.reviewCreditTransaction.aggregate({
        where: { clientId },
        _sum: {
          availableDelta: true,
          reservedDelta: true,
          consumedDelta: true,
          expiredDelta: true,
        },
      }),
    ]);
  const balance = {
    available: balanceTotals._sum.availableDelta ?? 0,
    reserved: balanceTotals._sum.reservedDelta ?? 0,
    consumed: balanceTotals._sum.consumedDelta ?? 0,
    expired: balanceTotals._sum.expiredDelta ?? 0,
  };
  return {
    balance,
    entitlements: entitlements.map((item) => ({
      id: item.id,
      serviceType: item.serviceType,
      status: item.status,
      quantityGranted: item.quantityGranted,
      quantityUsed: item.quantityUsed,
      grantedAt: item.grantedAt,
      expiresAt: item.expiresAt,
      product: item.productVersion
        ? {
            key: item.productVersion.serviceProduct.key,
            name: item.productVersion.name,
            version: item.productVersion.version,
          }
        : null,
      purchaseId: item.purchaseId,
    })),
    creditTransactions: transactions.map((item) => ({
      id: item.id,
      transactionType: item.transactionType,
      availableDelta: item.availableDelta,
      reservedDelta: item.reservedDelta,
      consumedDelta: item.consumedDelta,
      expiredDelta: item.expiredDelta,
      reason: item.reason,
      createdAt: item.createdAt,
      product: item.productVersion,
    })),
    pagination: {
      entitlementPage,
      transactionPage,
      pageSize,
      entitlementTotal,
      transactionTotal,
    },
    purchases: purchases.map((item) => ({
      id: item.id,
      status: item.status,
      amount: item.amount.toFixed(2),
      currency: item.currency,
      purchasedAt: item.purchasedAt,
      createdAt: item.createdAt,
      terms: item.termsSnapshot,
      product: item.productVersion
        ? {
            key: item.productVersion.serviceProduct.key,
            name: item.productVersion.name,
            version: item.productVersion.version,
          }
        : null,
      entitlementSummary: item.entitlements,
      reviewCreditsGranted: item.reviewCreditTransactions.reduce(
        (sum, transaction) => sum + Math.max(0, transaction.availableDelta),
        0,
      ),
      payment: item.payments[0] ?? null,
    })),
  };
}

export function createCommerceRouter(
  prisma: PrismaClient,
  authorization: AuthorizationService,
  denialRecorder?: AuthorizationDenialRecorder,
  paymentGateway?: PaymentGateway,
) {
  const router = Router();

  router.get('/client/services', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const products = await prisma.serviceProduct.findMany({
        where: { active: true, currentVersion: { not: null } },
        include: {
          versions: { where: { status: 'ACTIVE' }, orderBy: { version: 'desc' }, take: 1 },
        },
        orderBy: [{ updatedAt: 'desc' }, { key: 'asc' }],
      });
      const checkoutAvailable = paymentGateway ? (await paymentGateway.health()).healthy : false;
      res.json({
        services: products.flatMap((product) =>
          product.versions.map((version) => ({
            id: product.id,
            key: product.key,
            version: version.version,
            name: version.name,
            description: version.description,
            price: version.price.toFixed(2),
            currency: version.currency,
            entitlementType: version.entitlementType,
            includedQuantity: version.includedQuantity,
            includedReviewCredits: version.includedReviewCredits,
            prerequisiteCode: version.prerequisiteCode,
            eligibility: version.clientEligibilityCopy,
            checkoutAvailable,
          })),
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/client/services/active', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = z
        .object({
          entitlementPage: z.coerce.number().int().min(1).default(1),
          transactionPage: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      res.json(await clientCommerce(prisma, req.auth!.clientId!, input));
    } catch (error) {
      next(error);
    }
  });
  router.get('/client/services/history', requireRole('CLIENT'), async (req, res, next) => {
    try {
      const input = z
        .object({
          search: z.string().trim().max(120).default(''),
          status: z
            .enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'])
            .or(z.literal(''))
            .default(''),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const where: Prisma.ServicePurchaseWhereInput = {
        clientId: req.auth!.clientId!,
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { productVersion: { name: { contains: input.search, mode: 'insensitive' } } },
                {
                  productVersion: {
                    serviceProduct: { key: { contains: input.search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      };
      const [purchases, total] = await Promise.all([
        prisma.servicePurchase.findMany({
          where,
          include: {
            productVersion: { include: { serviceProduct: { select: { key: true } } } },
            entitlements: { select: { id: true, status: true, quantityGranted: true } },
            reviewCreditTransactions: { select: { availableDelta: true } },
            payments: {
              select: { provider: true, providerEnvironment: true, state: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.servicePurchase.count({ where }),
      ]);
      res.json({
        purchases: purchases.map((item) => ({
          id: item.id,
          status: item.status,
          amount: item.amount.toFixed(2),
          currency: item.currency,
          purchasedAt: item.purchasedAt,
          createdAt: item.createdAt,
          terms: item.termsSnapshot,
          product: item.productVersion
            ? {
                key: item.productVersion.serviceProduct.key,
                name: item.productVersion.name,
                version: item.productVersion.version,
              }
            : null,
          reviewCreditsGranted: item.reviewCreditTransactions.reduce(
            (sum, transaction) => sum + Math.max(0, transaction.availableDelta),
            0,
          ),
          payment: item.payments[0] ?? null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        hasMore: input.page * input.pageSize < total,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    '/consultant/clients/:clientId/services',
    requireRole('CONSULTANT'),
    requireClientAccess(authorization, 'clientId', denialRecorder),
    async (req, res, next) => {
      try {
        res.json(await clientCommerce(prisma, req.params.clientId as string));
      } catch (error) {
        next(error);
      }
    },
  );

  const adminGate = [
    requireRole('ADMIN'),
    requireCanonicalCapability(
      authorization,
      'commerce.manage',
      { requireStepUp: true },
      denialRecorder,
    ),
  ];
  router.get('/admin/service-products', ...adminGate, async (req, res, next) => {
    try {
      const input = z
        .object({
          search: z.string().trim().max(120).default(''),
          active: z.enum(['true', 'false']).optional(),
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(20),
        })
        .parse(req.query);
      const where: Prisma.ServiceProductWhereInput = {
        ...(input.search
          ? {
              OR: [
                { key: { contains: input.search, mode: 'insensitive' } },
                { versions: { some: { name: { contains: input.search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
        ...(input.active ? { active: input.active === 'true' } : {}),
      };
      const [total, products] = await prisma.$transaction([
        prisma.serviceProduct.count({ where }),
        prisma.serviceProduct.findMany({
          where,
          include: {
            versions: {
              orderBy: { version: 'desc' },
              include: { _count: { select: { purchases: true } } },
            },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
      ]);
      res.json({
        total,
        page: input.page,
        pageSize: input.pageSize,
        products: products.map((product) => ({
          ...product,
          versions: product.versions.map((version) => ({
            ...version,
            price: version.price.toFixed(2),
          })),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/admin/service-products/:productId', ...adminGate, async (req, res, next) => {
    try {
      const product = await prisma.serviceProduct.findUnique({
        where: { id: req.params.productId as string },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            include: { _count: { select: { purchases: true } } },
          },
        },
      });
      if (!product) throw new AppError('NOT_FOUND', 404, 'Service product was not found');
      res.json({
        product: {
          ...product,
          versions: product.versions.map((version) => ({
            ...version,
            price: version.price.toFixed(2),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/service-products', ...adminGate, async (req, res, next) => {
    try {
      const body = z
        .object({
          key: z
            .string()
            .trim()
            .regex(/^[A-Z0-9_]{3,80}$/),
          terms: termsInput,
        })
        .strict()
        .parse(req.body);
      const key = idempotencyKey(req);
      const result = await executeConsequentialCommand<CreatedProduct>(prisma, {
        idempotency: {
          scope: 'commerce-admin',
          subjectId: req.auth!.userId,
          operation: 'create-product',
          key,
          requestHash: hash(body),
        },
        audit: (created) => ({
          actorId: req.auth!.userId,
          action: 'SERVICE_PRODUCT_CREATED',
          entityType: 'ServiceProduct',
          entityId: created.productId,
        }),
        outbox: {
          eventType: 'commerce.product.created',
          eventKey: `commerce-product-create:${key}`,
          aggregateType: 'ServiceProduct',
          aggregateId: (created) => created.productId,
          payload: (created) => ({ productId: created.productId, domains: ['admin-services'] }),
        },
        mutate: async (tx) => {
          const product = await tx.serviceProduct.create({
            data: {
              key: body.key,
              versions: { create: { version: 1, ...versionData(body.terms) } },
            },
            include: { versions: true },
          });
          return { productId: product.id, versionId: product.versions[0]!.id };
        },
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/admin/service-products/:productId/versions',
    ...adminGate,
    async (req, res, next) => {
      try {
        const body = termsInput.parse(req.body);
        const key = idempotencyKey(req);
        const productId = req.params.productId as string;
        const result = await executeConsequentialCommand<CreatedVersion>(prisma, {
          idempotency: {
            scope: 'commerce-admin',
            subjectId: productId,
            operation: 'create-version',
            key,
            requestHash: hash(body),
          },
          audit: (created) => ({
            actorId: req.auth!.userId,
            action: 'SERVICE_PRODUCT_VERSION_CREATED',
            entityType: 'ServiceProductVersion',
            entityId: created.versionId,
            metadata: created,
          }),
          outbox: {
            eventType: 'commerce.product.version_created',
            eventKey: `commerce-product-version:${productId}:${key}`,
            aggregateType: 'ServiceProduct',
            aggregateId: productId,
            payload: (created) => ({
              productId,
              versionId: created.versionId,
              domains: ['admin-services'],
            }),
          },
          mutate: async (tx) => {
            const latest = await tx.serviceProductVersion.findFirst({
              where: { serviceProductId: productId },
              orderBy: { version: 'desc' },
              select: { version: true },
            });
            if (!latest) throw new AppError('NOT_FOUND', 404, 'Service product was not found');
            const version = await tx.serviceProductVersion.create({
              data: {
                serviceProductId: productId,
                version: latest.version + 1,
                ...versionData(body),
              },
            });
            return { productId, versionId: version.id, version: version.version };
          },
        });
        res.status(result.replayed ? 200 : 201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/admin/service-products/:productId/activate',
    ...adminGate,
    async (req, res, next) => {
      try {
        const body = z.object({ version: z.number().int().positive() }).strict().parse(req.body);
        const productId = req.params.productId as string;
        const key = idempotencyKey(req);
        const version = await prisma.serviceProductVersion.findUnique({
          where: {
            serviceProductId_version: { serviceProductId: productId, version: body.version },
          },
        });
        if (!version) throw new AppError('NOT_FOUND', 404, 'Service product version was not found');
        const blockers = validateActivatableProduct(version);
        if (blockers.length)
          throw new AppError('PRODUCT_ACTIVATION_BLOCKED', 409, blockers.join(' '));
        const result = await executeConsequentialCommand(prisma, {
          idempotency: {
            scope: 'commerce-admin',
            subjectId: productId,
            operation: 'activate-product',
            key,
            requestHash: hash(body),
          },
          audit: {
            actorId: req.auth!.userId,
            action: 'SERVICE_PRODUCT_ACTIVATED',
            entityType: 'ServiceProduct',
            entityId: productId,
            metadata: { version: body.version },
          },
          outbox: {
            eventType: 'commerce.product.activated',
            eventKey: `commerce-product-activate:${productId}:${body.version}:${key}`,
            aggregateType: 'ServiceProduct',
            aggregateId: productId,
            payload: { productId, version: body.version, domains: ['services', 'admin-services'] },
          },
          mutate: async (tx) => {
            await tx.serviceProductVersion.updateMany({
              where: { serviceProductId: productId, status: 'ACTIVE' },
              data: { status: 'RETIRED' },
            });
            await tx.serviceProductVersion.update({
              where: { id: version.id },
              data: { status: 'ACTIVE', effectiveAt: new Date() },
            });
            await tx.serviceProduct.update({
              where: { id: productId },
              data: { active: true, currentVersion: body.version },
            });
            return { productId, version: body.version } satisfies Prisma.InputJsonObject;
          },
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    '/admin/service-products/:productId/deactivate',
    ...adminGate,
    async (req, res, next) => {
      try {
        const productId = req.params.productId as string;
        const key = idempotencyKey(req);
        const result = await executeConsequentialCommand(prisma, {
          idempotency: {
            scope: 'commerce-admin',
            subjectId: productId,
            operation: 'deactivate-product',
            key,
          },
          audit: {
            actorId: req.auth!.userId,
            action: 'SERVICE_PRODUCT_DEACTIVATED',
            entityType: 'ServiceProduct',
            entityId: productId,
          },
          outbox: {
            eventType: 'commerce.product.deactivated',
            eventKey: `commerce-product-deactivate:${productId}:${key}`,
            aggregateType: 'ServiceProduct',
            aggregateId: productId,
            payload: { productId, domains: ['services', 'admin-services'] },
          },
          mutate: async (tx) => {
            await tx.serviceProduct.update({ where: { id: productId }, data: { active: false } });
            return { productId, active: false } satisfies Prisma.InputJsonObject;
          },
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
