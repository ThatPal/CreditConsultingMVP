import { Prisma, type PrismaClient, type PaymentState } from '../generated/prisma/client.js';
import type { VerifiedPaymentEvent } from './paymentGateway.js';

const rank: Record<PaymentState, number> = {
  PENDING: 0,
  AWAITING_CUSTOMER: 1,
  PROCESSING: 2,
  FAILED: 3,
  CANCELLED: 3,
  SUCCEEDED: 4,
  PARTIALLY_REFUNDED: 5,
  REFUNDED: 6,
};
export function permitsPaymentTransition(from: PaymentState, to: PaymentState) {
  if (from === to) return false;
  if (from === 'SUCCEEDED' && !['PARTIALLY_REFUNDED', 'REFUNDED'].includes(to)) return false;
  if (['FAILED', 'CANCELLED', 'REFUNDED'].includes(from)) return false;
  return rank[to] >= rank[from];
}

export async function applyVerifiedPaymentEvent(prisma: PrismaClient, event: VerifiedPaymentEvent) {
  try {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          provider: event.provider,
          OR: [
            event.providerOrderId ? { providerOrderId: event.providerOrderId } : undefined,
            event.providerPaymentId ? { providerPaymentId: event.providerPaymentId } : undefined,
          ].filter(Boolean) as Prisma.PaymentWhereInput[],
        },
        include: {
          purchase: { include: { productVersion: true } },
          client: { include: { user: true } },
        },
      });
      if (!payment) {
        await tx.paymentProviderEvent.create({
          data: {
            provider: event.provider,
            providerEventId: event.providerEventId,
            eventType: event.eventType,
            disposition: 'IGNORED',
            normalizedState: event.state,
            occurredAt: event.occurredAt,
            safeMetadata: { reason: 'UNKNOWN_REFERENCE' },
          },
        });
        return { applied: false, reason: 'UNKNOWN_REFERENCE' };
      }
      const transition = permitsPaymentTransition(payment.state, event.state);
      const providerEvent = await tx.paymentProviderEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          disposition: transition ? 'APPLIED' : 'IGNORED',
          normalizedState: event.state,
          paymentId: payment.id,
          occurredAt: event.occurredAt,
          ...(transition ? {} : { safeMetadata: { reason: 'NON_MONOTONIC_OR_NO_CHANGE' } }),
        },
      });
      if (event.dispute) {
        const disputeRank = { OPEN: 0, UNDER_REVIEW: 1, WON: 2, LOST: 2, CLOSED: 3 } as const;
        const current = await tx.paymentDispute.findUnique({
          where: {
            provider_providerDisputeId: {
              provider: event.provider,
              providerDisputeId: event.dispute.providerDisputeId,
            },
          },
        });
        if (!current || disputeRank[event.dispute.status] >= disputeRank[current.status]) {
          await tx.paymentDispute.upsert({
            where: {
              provider_providerDisputeId: {
                provider: event.provider,
                providerDisputeId: event.dispute.providerDisputeId,
              },
            },
            create: {
              paymentId: payment.id,
              clientId: payment.clientId,
              provider: payment.provider,
              providerDisputeId: event.dispute.providerDisputeId,
              status: event.dispute.status,
              ...(event.dispute.amount ? { amount: event.dispute.amount } : {}),
              ...(event.dispute.currency ? { currency: event.dispute.currency } : {}),
              ...(event.dispute.reason ? { reason: event.dispute.reason } : {}),
              ...(event.dispute.evidenceDueAt
                ? { evidenceDueAt: event.dispute.evidenceDueAt }
                : {}),
              providerOccurredAt: event.occurredAt,
            },
            update: {
              status: event.dispute.status,
              ...(event.dispute.amount ? { amount: event.dispute.amount } : {}),
              ...(event.dispute.currency ? { currency: event.dispute.currency } : {}),
              ...(event.dispute.reason ? { reason: event.dispute.reason } : {}),
              ...(event.dispute.evidenceDueAt
                ? { evidenceDueAt: event.dispute.evidenceDueAt }
                : {}),
              providerOccurredAt: event.occurredAt,
            },
          });
          await tx.auditEvent.create({
            data: {
              clientId: payment.clientId,
              action: 'PAYMENT_DISPUTE_UPDATED',
              entityType: 'PaymentDispute',
              entityId: event.dispute.providerDisputeId,
              metadata: { provider: payment.provider, status: event.dispute.status },
            },
          });
          await tx.outboxEvent.create({
            data: {
              eventType: 'commerce.dispute.updated',
              eventKey: `dispute-event:${providerEvent.id}`,
              aggregateType: 'Payment',
              aggregateId: payment.id,
              payload: {
                clientId: payment.clientId,
                paymentId: payment.id,
                domains: ['admin-payments'],
              },
            },
          });
        }
        return { applied: true, paymentId: payment.id, dispute: true };
      }
      if (!transition)
        return { applied: false, reason: 'NON_MONOTONIC_OR_NO_CHANGE', paymentId: payment.id };
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          state: event.state,
          providerPaymentId: event.providerPaymentId ?? payment.providerPaymentId,
          verifiedProviderEventId: event.providerEventId,
          occurredAt: event.occurredAt,
          lastErrorCode: event.state === 'FAILED' ? 'PROVIDER_REPORTED_FAILURE' : null,
        },
      });
      if (event.state !== 'SUCCEEDED') {
        if (event.state === 'FAILED' || event.state === 'CANCELLED')
          await tx.servicePurchase.update({
            where: { id: payment.purchaseId },
            data: { status: event.state },
          });
        await tx.auditEvent.create({
          data: {
            clientId: payment.clientId,
            action: `PAYMENT_${event.state}`,
            entityType: 'Payment',
            entityId: payment.id,
            metadata: { provider: payment.provider, providerEventId: event.providerEventId },
          },
        });
        await tx.outboxEvent.create({
          data: {
            eventType: 'commerce.payment.updated',
            eventKey: `payment-event:${providerEvent.id}`,
            aggregateType: 'Payment',
            aggregateId: payment.id,
            payload: {
              clientId: payment.clientId,
              paymentId: payment.id,
              purchaseId: payment.purchaseId,
              state: event.state,
              domains: ['services', 'payments', 'admin-payments'],
            },
          },
        });
        return { applied: true, paymentId: payment.id, state: event.state };
      }
      const version = payment.purchase.productVersion;
      if (!version) throw new Error('PURCHASE_VERSION_REQUIRED');
      const paymentReference = event.providerPaymentId ?? event.providerOrderId;
      await tx.servicePurchase.update({
        where: { id: payment.purchaseId },
        data: {
          status: 'PAID',
          purchasedAt: event.occurredAt,
          paymentProvider: payment.provider,
          ...(paymentReference ? { paymentReference } : {}),
        },
      });
      await tx.serviceEntitlement.upsert({
        where: { sourceKey: `purchase:${payment.purchaseId}:entitlement` },
        create: {
          clientId: payment.clientId,
          purchaseId: payment.purchaseId,
          productVersionId: version.id,
          sourceKey: `purchase:${payment.purchaseId}:entitlement`,
          serviceType: version.entitlementType,
          quantityGranted: version.includedQuantity,
        },
        update: {},
      });
      if (version.includedReviewCredits > 0)
        await tx.reviewCreditTransaction.upsert({
          where: { sourceKey: `purchase:${payment.purchaseId}:review-credits` },
          create: {
            clientId: payment.clientId,
            purchaseId: payment.purchaseId,
            productVersionId: version.id,
            sourceKey: `purchase:${payment.purchaseId}:review-credits`,
            correlationId: payment.purchaseId,
            transactionType: 'PURCHASE',
            availableDelta: version.includedReviewCredits,
            reason: `Included with ${version.name} v${version.version}`,
          },
          update: {},
        });
      if (payment.client.user)
        await tx.notification.upsert({
          where: {
            userId_semanticKey: {
              userId: payment.client.user.id,
              semanticKey: `purchase-paid:${payment.purchaseId}`,
            },
          },
          create: {
            userId: payment.client.user.id,
            clientId: payment.clientId,
            semanticKey: `purchase-paid:${payment.purchaseId}`,
            type: 'PURCHASE_PAID',
            category: 'OPERATIONAL',
            title: 'Payment confirmed',
            body: `Your ${version.name} purchase is confirmed.`,
            link: '/app/services/active',
            safePayload: { purchaseId: payment.purchaseId },
          },
          update: {},
        });
      await tx.auditEvent.create({
        data: {
          clientId: payment.clientId,
          action: 'PAYMENT_SUCCEEDED_AND_EFFECTS_GRANTED',
          entityType: 'Payment',
          entityId: payment.id,
          metadata: {
            provider: payment.provider,
            providerEventId: event.providerEventId,
            purchaseId: payment.purchaseId,
          },
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventType: 'commerce.purchase.paid',
          eventKey: `purchase-paid:${payment.purchaseId}`,
          aggregateType: 'ServicePurchase',
          aggregateId: payment.purchaseId,
          payload: {
            clientId: payment.clientId,
            paymentId: payment.id,
            purchaseId: payment.purchaseId,
            domains: ['services', 'notifications', 'client-context', 'admin-payments'],
          },
        },
      });
      return { applied: true, paymentId: payment.id, state: event.state, effectsGranted: true };
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const replay = await prisma.paymentProviderEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: event.provider,
            providerEventId: event.providerEventId,
          },
        },
        select: { id: true },
      });
      if (replay) return { applied: false, reason: 'DUPLICATE_EVENT' };
    }
    throw error;
  }
}
