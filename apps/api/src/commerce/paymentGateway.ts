import type { CheckoutRequest, CheckoutResponse, PaymentProvider } from '@credit/shared';

export type VerifiedPaymentEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  providerPaymentId: string;
  purchaseId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  amount: number;
  currency: string;
  occurredAt: Date;
};

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: Buffer,
  ): Promise<VerifiedPaymentEvent>;
}

export interface ReviewCreditLedger {
  grantFromVerifiedPayment(event: VerifiedPaymentEvent, quantity: number): Promise<void>;
  grantAdminAdjustment(input: {
    clientId: string;
    quantity: number;
    authorizedByUserId: string;
    reason: string;
  }): Promise<void>;
  reserve(clientId: string, reviewId: string): Promise<string>;
  consume(transactionId: string): Promise<void>;
  release(transactionId: string, reason: string): Promise<void>;
}
