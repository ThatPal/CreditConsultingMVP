import type { PrismaClient } from '../generated/prisma/client.js';
import type { ServiceStore } from './types.js';
export function createPrismaServiceStore(prisma: PrismaClient): ServiceStore {
  return {
    async listDefinitions() {
      return (await prisma.serviceDefinition.findMany()).map((item) => ({
        ...item,
        price: item.price.toNumber(),
      }));
    },
    async updateDefinition(serviceType, price, active) {
      const item = await prisma.serviceDefinition.upsert({
        where: { serviceType },
        create: { serviceType, price, active },
        update: { price, active },
      });
      return { ...item, price: item.price.toNumber() };
    },
    async listPurchases(clientId) {
      return (
        await prisma.servicePurchase.findMany({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      ).map((item) => ({
        id: item.id,
        serviceType: item.serviceType,
        amount: item.amount.toNumber(),
        currency: item.currency,
        status: item.status,
        purchasedAt: item.purchasedAt,
        createdAt: item.createdAt,
      }));
    },
    async listReviewPlans(clientId) {
      return (
        await prisma.reviewPlan.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } })
      ).map((item) => ({
        id: item.id,
        frequency: item.frequency,
        status: item.status,
        price: item.price.toNumber(),
        currency: item.currency,
        nextReviewAt: item.nextReviewAt,
      }));
    },
  };
}
