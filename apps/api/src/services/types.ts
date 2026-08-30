export type PurchaseDto = {
  id: string;
  serviceType: 'CREDIT_PROFILE_REVIEW' | 'CREDIT_CARD_ROUND' | 'MAJOR_APPLICATION_READINESS';
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  purchasedAt: Date | null;
  createdAt: Date;
};
export type ReviewPlanDto = {
  id: string;
  frequency: 'SEMIANNUAL' | 'QUARTERLY' | 'MONTHLY';
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  price: number;
  currency: string;
  nextReviewAt: Date | null;
};
export interface ServiceStore {
  listDefinitions(): Promise<Array<{ serviceType: PurchaseDto['serviceType']; price: number; currency: string; active: boolean }>>;
  updateDefinition(serviceType: PurchaseDto['serviceType'], price: number, active: boolean): Promise<{ serviceType: PurchaseDto['serviceType']; price: number; currency: string; active: boolean }>;
  listPurchases(clientId: string): Promise<PurchaseDto[]>;
  listReviewPlans(clientId: string): Promise<ReviewPlanDto[]>;
}
