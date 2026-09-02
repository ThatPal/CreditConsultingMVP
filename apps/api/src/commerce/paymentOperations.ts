import { createHash } from 'node:crypto';
import {
  Prisma,
  type PaymentProvider,
  type PrismaClient,
} from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import type { PaymentGatewayRegistry } from './paymentGateway.js';
import { applyVerifiedPaymentEvent, permitsPaymentTransition } from './paymentService.js';

export async function ensureGatewayConfigs(prisma: PrismaClient, registry: PaymentGatewayRegistry) {
  for (const gateway of registry.list()) {
    const provider = gateway.provider;
    const health = await gateway.health();
    await prisma.paymentGatewayConfig.upsert({
      where: { provider },
      create: {
        provider,
        environment: health.environment,
        configured: health.configured,
        connected: health.connectionVerified ?? health.healthy,
        enabledForNewPayments: provider === registry.defaultProvider && health.healthy,
        defaultForCheckout: false,
        status: health.healthy ? 'HEALTHY' : health.configured ? 'DEGRADED' : 'UNTESTED',
        secretReferences: [],
        configurationMetadata: { capabilities: health.capabilities ?? null },
      },
      update: {
        environment: health.environment,
        configured: health.configured,
        connected: health.connectionVerified ?? health.healthy,
        status: health.healthy ? 'HEALTHY' : health.configured ? 'DEGRADED' : 'UNTESTED',
        configurationMetadata: { capabilities: health.capabilities ?? null },
      },
    });
  }
  // Deterministic registries are isolated test fixtures; mirror their declared default.
  if (registry.list().some((gateway) => gateway.environment === 'TEST')) {
    const targetHealth = await registry.getDefault().health();
    await prisma.paymentGatewayConfig.updateMany({ data: { defaultForCheckout: false } });
    if (targetHealth.healthy)
      await prisma.paymentGatewayConfig.update({
        where: { provider: registry.defaultProvider },
        data: {
          configured: true,
          connected: true,
          enabledForNewPayments: true,
          defaultForCheckout: true,
        },
      });
  } else if (!(await prisma.paymentGatewayConfig.count({ where: { defaultForCheckout: true } }))) {
    const targetHealth = await registry.getDefault().health();
    if (targetHealth.healthy)
      await prisma.paymentGatewayConfig.update({
        where: { provider: registry.defaultProvider },
        data: { enabledForNewPayments: true, defaultForCheckout: true },
      });
  }
}

export async function canonicalDefaultGateway(
  prisma: PrismaClient,
  registry: PaymentGatewayRegistry,
) {
  await ensureGatewayConfigs(prisma, registry);
  const config = await prisma.paymentGatewayConfig.findFirst({
    where: { defaultForCheckout: true, enabledForNewPayments: true },
  });
  if (!config)
    throw new AppError(
      'PAYMENT_DEFAULT_UNAVAILABLE',
      503,
      'No payment gateway is available for new checkout',
    );
  const gateway = registry.get(config.provider);
  const health = await gateway.health();
  if (!health.healthy || !health.configured)
    throw new AppError(
      'PAYMENT_DEFAULT_UNAVAILABLE',
      503,
      'The selected payment gateway is unavailable',
    );
  return { gateway, config };
}

export async function setDefaultGateway(
  prisma: PrismaClient,
  provider: PaymentProvider,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payment-gateway-default'))`;
      const target = await tx.paymentGatewayConfig.findUnique({ where: { provider } });
      if (!target?.configured || !target.connected || !target.enabledForNewPayments)
        throw new AppError(
          'GATEWAY_NOT_READY',
          409,
          'Gateway must be configured, connected, and enabled',
        );
      await tx.paymentGatewayConfig.updateMany({ data: { defaultForCheckout: false } });
      const result = await tx.paymentGatewayConfig.update({
        where: { provider },
        data: { defaultForCheckout: true, version: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: 'PAYMENT_GATEWAY_DEFAULT_SET',
          entityType: 'PaymentGatewayConfig',
          entityId: result.id,
          metadata: { provider },
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'commerce.gateway.default.changed',
          eventKey: `gateway-default:${result.id}:${result.version}`,
          aggregateType: 'PaymentGatewayConfig',
          aggregateId: result.id,
          payload: { provider, domains: ['admin-payments', 'services'] },
        },
      });
      return result;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setGatewayEnabled(
  prisma: PrismaClient,
  provider: PaymentProvider,
  enabled: boolean,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payment-gateway-default'))`;
      const existing = await tx.paymentGatewayConfig.findUnique({ where: { provider } });
      if (!existing) throw new AppError('NOT_FOUND', 404, 'Gateway configuration was not found');
      if (!enabled && existing.defaultForCheckout)
        throw new AppError(
          'DEFAULT_GATEWAY_CANNOT_BE_DISABLED',
          409,
          'Select another default before disabling this gateway',
        );
      const result = await tx.paymentGatewayConfig.update({
        where: { provider },
        data: { enabledForNewPayments: enabled, version: { increment: 1 } },
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: enabled ? 'PAYMENT_GATEWAY_ENABLED' : 'PAYMENT_GATEWAY_DISABLED',
          entityType: 'PaymentGatewayConfig',
          entityId: result.id,
          metadata: { provider },
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'commerce.gateway.updated',
          eventKey: `gateway-enabled:${result.id}:${result.version}`,
          aggregateType: 'PaymentGatewayConfig',
          aggregateId: result.id,
          payload: { provider, enabled, domains: ['admin-payments'] },
        },
      });
      return result;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function testGatewayConnection(
  prisma: PrismaClient,
  registry: PaymentGatewayRegistry,
  provider: PaymentProvider,
  actorId: string,
) {
  await ensureGatewayConfigs(prisma, registry);
  const health = await registry.get(provider).health();
  const now = new Date();
  const config = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentGatewayConfig.update({
      where: { provider },
      data: {
        configured: health.configured,
        connected: health.connectionVerified ?? health.healthy,
        status: health.healthy ? 'HEALTHY' : health.configured ? 'DEGRADED' : 'FAILED',
        lastTestedAt: now,
        ...(health.healthy
          ? { lastSuccessAt: now, lastErrorCategory: null }
          : { lastErrorCategory: 'CONNECTION_TEST_FAILED' }),
        version: { increment: 1 },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId,
        action: 'PAYMENT_GATEWAY_CONNECTION_TESTED',
        entityType: 'PaymentGatewayConfig',
        entityId: updated.id,
        metadata: { provider, healthy: health.healthy },
      },
    });
    return updated;
  });
  return { gateway: health, config };
}

export async function updateGatewayMetadata(
  prisma: PrismaClient,
  provider: PaymentProvider,
  metadata: { displayName?: string; accountReference?: string },
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentGatewayConfig.update({
      where: { provider },
      data: { configurationMetadata: metadata, version: { increment: 1 } },
    });
    await tx.auditEvent.create({
      data: {
        actorId,
        action: 'PAYMENT_GATEWAY_CONFIGURATION_UPDATED',
        entityType: 'PaymentGatewayConfig',
        entityId: updated.id,
        metadata: { provider, fields: Object.keys(metadata) },
      },
    });
    await tx.outboxEvent.create({
      data: {
        eventType: 'commerce.gateway.updated',
        eventKey: `gateway-config:${updated.id}:${updated.version}`,
        aggregateType: 'PaymentGatewayConfig',
        aggregateId: updated.id,
        payload: { provider, domains: ['admin-payments'] },
      },
    });
    return updated;
  });
}

export async function requestRefund(
  prisma: PrismaClient,
  registry: PaymentGatewayRegistry,
  input: {
    paymentId: string;
    amount: string;
    reason?: string;
    actorId: string;
    idempotencyKey: string;
  },
) {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      client: { include: { user: true } },
      purchase: {
        include: { productVersion: true, entitlements: true, reviewCreditTransactions: true },
      },
      refunds: true,
    },
  });
  if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment was not found');
  if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(payment.state))
    throw new AppError('PAYMENT_NOT_REFUNDABLE', 409, 'Payment is not refundable');
  if (!payment.providerPaymentId)
    throw new AppError(
      'PROVIDER_REFERENCE_MISSING',
      409,
      'Provider payment reference is unavailable',
    );
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0))
    throw new AppError('INVALID_REFUND_AMOUNT', 400, 'Refund amount must be positive');
  const existing = payment.refunds.find((refund) => refund.idempotencyKey === input.idempotencyKey);
  if (existing && existing.status !== 'FAILED') return existing;
  const reserved = payment.refunds
    .filter((refund) => ['REQUESTED', 'PROCESSING', 'SUCCEEDED'].includes(refund.status))
    .reduce((sum, refund) => sum.add(refund.amount), new Prisma.Decimal(0));
  if (reserved.add(amount).gt(payment.amount))
    throw new AppError(
      'REFUND_EXCEEDS_AVAILABLE',
      409,
      'Refund exceeds the remaining refundable amount',
    );
  const refund = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${payment.id}`}))`;
      const aggregate = await tx.paymentRefund.aggregate({
        where: { paymentId: payment.id, status: { in: ['REQUESTED', 'PROCESSING', 'SUCCEEDED'] } },
        _sum: { amount: true },
      });
      if (new Prisma.Decimal(aggregate._sum.amount ?? 0).add(amount).gt(payment.amount))
        throw new AppError(
          'REFUND_EXCEEDS_AVAILABLE',
          409,
          'Refund exceeds the remaining refundable amount',
        );
      if (existing)
        return tx.paymentRefund.update({
          where: { id: existing.id },
          data: { status: 'REQUESTED', ...(input.reason ? { reason: input.reason } : {}) },
        });
      return tx.paymentRefund.create({
        data: {
          paymentId: payment.id,
          purchaseId: payment.purchaseId,
          clientId: payment.clientId,
          provider: payment.provider,
          idempotencyKey: input.idempotencyKey,
          amount,
          currency: payment.currency,
          ...(input.reason ? { reason: input.reason } : {}),
          actorId: input.actorId,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  try {
    const result = await registry
      .get(payment.provider)
      .refund({
        paymentId: payment.id,
        providerPaymentId: payment.providerPaymentId,
        refundId: refund.id,
        amount: amount.toFixed(2),
        currency: payment.currency,
      });
    return prisma.$transaction(async (tx) => {
      const completed = await tx.paymentRefund.update({
        where: { id: refund.id },
        data: {
          providerRefundId: result.providerRefundId,
          status: result.status,
          ...(result.status === 'SUCCEEDED' ? { completedAt: new Date() } : {}),
        },
      });
      if (result.status === 'SUCCEEDED') {
        const total = await tx.paymentRefund.aggregate({
          where: { paymentId: payment.id, status: 'SUCCEEDED' },
          _sum: { amount: true },
        });
        const full = new Prisma.Decimal(total._sum.amount ?? 0).gte(payment.amount);
        await tx.payment.update({
          where: { id: payment.id },
          data: { state: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
        });
        if (full) {
          await tx.servicePurchase.update({
            where: { id: payment.purchaseId },
            data: { status: 'REFUNDED', refundedAt: new Date() },
          });
          await tx.serviceEntitlement.updateMany({
            where: { purchaseId: payment.purchaseId, status: { in: ['ACTIVE', 'RESERVED'] } },
            data: { status: 'CANCELLED' },
          });
          const available = payment.purchase.reviewCreditTransactions.reduce(
            (sum, item) => sum + item.availableDelta,
            0,
          );
          if (available > 0)
            await tx.reviewCreditTransaction.upsert({
              where: { sourceKey: `refund:${refund.id}:review-credit-reversal` },
              create: {
                clientId: payment.clientId,
                purchaseId: payment.purchaseId,
                productVersionId: payment.purchase.productVersionId,
                sourceKey: `refund:${refund.id}:review-credit-reversal`,
                correlationId: refund.id,
                transactionType: 'ADMIN_ADJUSTMENT',
                availableDelta: -available,
                reason: 'Unused Review Credit revoked after full refund',
                authorizedByUserId: input.actorId,
              },
              update: {},
            });
        }
        await tx.auditEvent.create({
          data: {
            clientId: payment.clientId,
            actorId: input.actorId,
            action: 'PAYMENT_REFUND_SUCCEEDED',
            entityType: 'PaymentRefund',
            entityId: refund.id,
            metadata: { provider: payment.provider, amount: amount.toFixed(2), full },
          },
        });
        if (payment.client.user)
          await tx.notification.upsert({
            where: {
              userId_semanticKey: {
                userId: payment.client.user.id,
                semanticKey: `refund-succeeded:${refund.id}`,
              },
            },
            create: {
              userId: payment.client.user.id,
              clientId: payment.clientId,
              semanticKey: `refund-succeeded:${refund.id}`,
              type: 'PAYMENT_REFUND',
              category: 'OPERATIONAL',
              title: 'Refund completed',
              body: `A ${amount.toFixed(2)} ${payment.currency} refund was completed.`,
              link: '/app/services/purchases',
              safePayload: { purchaseId: payment.purchaseId, refundId: refund.id },
            },
            update: {},
          });
        await tx.outboxEvent.create({
          data: {
            eventType: 'commerce.refund.succeeded',
            eventKey: `refund-succeeded:${refund.id}`,
            aggregateType: 'PaymentRefund',
            aggregateId: refund.id,
            payload: {
              clientId: payment.clientId,
              paymentId: payment.id,
              purchaseId: payment.purchaseId,
              domains: ['services', 'payments', 'admin-payments', 'notifications'],
            },
          },
        });
      }
      return completed;
    });
  } catch (error) {
    await prisma.paymentRefund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
    throw error;
  }
}

export async function reconcilePayment(
  prisma: PrismaClient,
  registry: PaymentGatewayRegistry,
  input: { paymentId: string; actorId: string; idempotencyKey: string },
) {
  const existing = await prisma.paymentReconciliation.findUnique({
    where: {
      paymentId_idempotencyKey: {
        paymentId: input.paymentId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) return existing;
  const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new AppError('NOT_FOUND', 404, 'Payment was not found');
  if (!payment.providerOrderId)
    throw new AppError('PROVIDER_REFERENCE_MISSING', 409, 'Provider reference is unavailable');
  const gateway = registry.get(payment.provider);
  try {
    const event = await gateway.retrieve(payment.providerOrderId);
    const correctable = permitsPaymentTransition(payment.state, event.state);
    if (correctable) await applyVerifiedPaymentEvent(prisma, event);
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.paymentReconciliation.create({
        data: {
          paymentId: payment.id,
          provider: payment.provider,
          idempotencyKey: input.idempotencyKey,
          status: correctable ? 'CORRECTED' : 'SUCCEEDED',
          beforeState: payment.state,
          providerState: event.state,
          corrected: correctable,
          actorId: input.actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          clientId: payment.clientId,
          actorId: input.actorId,
          action: correctable
            ? 'PAYMENT_RECONCILIATION_CORRECTED'
            : 'PAYMENT_RECONCILIATION_COMPLETED',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: { provider: payment.provider, providerState: event.state },
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'commerce.payment.reconciled',
          eventKey: `payment-reconciled:${attempt.id}`,
          aggregateType: 'Payment',
          aggregateId: payment.id,
          payload: {
            clientId: payment.clientId,
            paymentId: payment.id,
            domains: ['payments', 'admin-payments'],
          },
        },
      });
      return attempt;
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'RECONCILIATION_FAILED';
    const blocked = code.includes('UNSUPPORTED');
    const attempt = await prisma.paymentReconciliation.create({
      data: {
        paymentId: payment.id,
        provider: payment.provider,
        idempotencyKey: input.idempotencyKey,
        status: blocked ? 'BLOCKED' : 'FAILED',
        beforeState: payment.state,
        errorCode: code,
        actorId: input.actorId,
      },
    });
    if (blocked) return attempt;
    throw error;
  }
}

export const safeCommandHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
