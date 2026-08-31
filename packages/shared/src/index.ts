export type ApiErrorBody = {
  error: { code: string; message: string; requestId?: string };
};

export type HealthResponse = { status: 'ok' };

export const liveEventDomains = [
  'application-cycles',
  'credit-profile',
  'notifications',
  'review',
  'services',
  'support',
  'work-queue',
] as const;
export type LiveEventDomain = (typeof liveEventDomains)[number];
export type LiveEventEnvelope = {
  id: string;
  version: 1;
  type: 'resource.changed';
  occurredAt: string;
  clientId: string;
  domains: LiveEventDomain[];
};

export type PaymentProvider = 'PAYPAL' | 'STRIPE' | 'BOFA_MERCHANT';
export type PaymentState =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type CheckoutRequest = {
  purchaseId: string;
  amount: number;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
};
export type CheckoutResponse = {
  provider: PaymentProvider;
  providerOrderId: string;
  redirectUrl: string;
};

export type ReviewCreditBalance = {
  available: number;
  reserved: number;
  consumed: number;
  expired: number;
};
