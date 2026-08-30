import type { ServiceStore } from './types.js';
const catalog = [
  {
    serviceType: 'CREDIT_PROFILE_REVIEW',
    name: 'Credit Profile Review',
    description:
      'A consultant-led review that produces an updated credit snapshot, readiness level, and strategy recommendation.',
    requiresCurrentProfile: false,
    availability: 'PRICING_REQUIRED',
  },
  {
    serviceType: 'CREDIT_CARD_ROUND',
    name: 'Optimized Credit Card Round',
    description:
      'Coordinated card strategy, preparation, scheduling, live applications, and analysis.',
    requiresCurrentProfile: true,
    availability: 'PROFILE_REQUIRED',
  },
  {
    serviceType: 'MAJOR_APPLICATION_READINESS',
    name: 'Major Credit Application Readiness',
    description: 'Preparation and timing guidance for a major planned credit application.',
    requiresCurrentProfile: true,
    availability: 'PRICING_REQUIRED',
  },
] as const;
export function createServiceCatalog(store: ServiceStore) {
  return {
    async getClientServices(clientId: string) {
      const [purchases, reviewPlans, definitions] = await Promise.all([
        store.listPurchases(clientId),
        store.listReviewPlans(clientId),
        store.listDefinitions(),
      ]);
      return {
        catalog: catalog.map((service) => {
          const definition = definitions.find((item) => item.serviceType === service.serviceType);
          return {
            ...service,
            price: definition?.price ?? null,
            currency: definition?.currency ?? 'USD',
            active: definition?.active ?? false,
            checkoutAvailable: false,
          };
        }),
        purchases,
        reviewPlans,
      };
    },
    listDefinitions: () => store.listDefinitions(),
    updateDefinition: (serviceType: 'CREDIT_PROFILE_REVIEW' | 'CREDIT_CARD_ROUND' | 'MAJOR_APPLICATION_READINESS', price: number, active: boolean) =>
      store.updateDefinition(serviceType, price, active),
  };
}
export type ServiceCatalog = ReturnType<typeof createServiceCatalog>;
