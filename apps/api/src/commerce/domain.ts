import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { AppError } from '../http/errors.js';
import { executeConsequentialCommand } from '../transactions/consequentialCommand.js';

export type ProductTerms = {
  productKey: string;
  version: number;
  name: string;
  description: string;
  amount: string;
  currency: string;
  entitlementType: string;
  includedQuantity: number;
  includedReviewCredits: number;
};

export function validateActivatableProduct(input: {
  name: string;
  description: string;
  price: Prisma.Decimal;
  currency: string;
  entitlementType: string | null;
  includedQuantity: number;
  includedReviewCredits: number;
}) {
  const blockers: string[] = [];
  if (!input.name.trim()) blockers.push('Client-facing name is required.');
  if (!input.description.trim()) blockers.push('Client-facing description is required.');
  if (input.price.lessThan(0)) blockers.push('Price cannot be negative.');
  if (!/^[A-Z]{3}$/.test(input.currency)) blockers.push('Currency must be a three-letter code.');
  if (!input.entitlementType) blockers.push('Entitlement mapping is required.');
  if (input.includedQuantity < 1) blockers.push('Included quantity must be at least one.');
  if (input.includedReviewCredits < 0) blockers.push('Included Review Credits cannot be negative.');
  return blockers;
}

export function frozenTerms(
  productKey: string,
  version: {
    version: number;
    name: string;
    description: string;
    price: Prisma.Decimal;
    currency: string;
    entitlementType: string;
    includedQuantity: number;
    includedReviewCredits: number;
  },
): ProductTerms {
  return {
    productKey,
    version: version.version,
    name: version.name,
    description: version.description,
    amount: version.price.toFixed(2),
    currency: version.currency,
    entitlementType: version.entitlementType,
    includedQuantity: version.includedQuantity,
    includedReviewCredits: version.includedReviewCredits,
  };
}

export function deriveReviewCreditBalance(
  entries: Array<{
    availableDelta: number;
    reservedDelta: number;
    consumedDelta: number;
    expiredDelta: number;
  }>,
) {
  return entries.reduce(
    (balance, entry) => ({
      available: balance.available + entry.availableDelta,
      reserved: balance.reserved + entry.reservedDelta,
      consumed: balance.consumed + entry.consumedDelta,
      expired: balance.expired + entry.expiredDelta,
    }),
    { available: 0, reserved: 0, consumed: 0, expired: 0 },
  );
}

export async function grantVerifiedPurchaseEffects(
  prisma: PrismaClient,
  input: { purchaseId: string; actorId: string; idempotencyKey: string },
) {
  const purchase = await prisma.servicePurchase.findUnique({
    where: { id: input.purchaseId },
    include: { productVersion: { include: { serviceProduct: true } } },
  });
  if (!purchase?.productVersion || purchase.status !== 'PAID')
    throw new AppError('VERIFIED_PURCHASE_REQUIRED', 409, 'A verified paid purchase is required');
  const requestHash = createHash('sha256').update(input.purchaseId).digest('hex');
  const version = purchase.productVersion;
  return executeConsequentialCommand(prisma, {
    idempotency: {
      scope: 'commerce',
      subjectId: purchase.clientId,
      operation: 'grant-purchase-effects',
      key: input.idempotencyKey,
      requestHash,
    },
    audit: (result) => ({
      clientId: purchase.clientId,
      actorId: input.actorId,
      action: 'COMMERCIAL_EFFECTS_GRANTED',
      entityType: 'ServicePurchase',
      entityId: purchase.id,
      metadata: result,
    }),
    outbox: {
      eventType: 'commerce.purchase.effects_granted',
      eventKey: `commerce-effects:${purchase.id}`,
      aggregateType: 'ServicePurchase',
      aggregateId: purchase.id,
      payload: {
        clientId: purchase.clientId,
        purchaseId: purchase.id,
        domains: ['services', 'client-context', 'admin-services'],
      },
    },
    mutate: async (tx) => {
      const entitlement = await tx.serviceEntitlement.upsert({
        where: { sourceKey: `purchase:${purchase.id}:entitlement` },
        create: {
          clientId: purchase.clientId,
          purchaseId: purchase.id,
          productVersionId: version.id,
          sourceKey: `purchase:${purchase.id}:entitlement`,
          serviceType: version.entitlementType,
          quantityGranted: version.includedQuantity,
        },
        update: {},
      });
      let creditTransactionId: string | null = null;
      if (version.includedReviewCredits > 0) {
        const transaction = await tx.reviewCreditTransaction.upsert({
          where: { sourceKey: `purchase:${purchase.id}:review-credits` },
          create: {
            clientId: purchase.clientId,
            purchaseId: purchase.id,
            productVersionId: version.id,
            sourceKey: `purchase:${purchase.id}:review-credits`,
            correlationId: purchase.id,
            transactionType: 'PURCHASE',
            availableDelta: version.includedReviewCredits,
            reason: `Included with ${version.name} v${version.version}`,
            authorizedByUserId: input.actorId,
          },
          update: {},
        });
        creditTransactionId = transaction.id;
      }
      return {
        purchaseId: purchase.id,
        entitlementId: entitlement.id,
        creditTransactionId,
      } satisfies Prisma.InputJsonObject;
    },
  });
}
