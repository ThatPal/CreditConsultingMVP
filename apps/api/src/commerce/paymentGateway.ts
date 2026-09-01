import type { PaymentProvider, PaymentState } from '../generated/prisma/client.js';

export type ProviderCheckoutRequest = {
  paymentId: string;
  purchaseId: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
};
export type VerifiedPaymentEvent = {
  provider: PaymentProvider;
  providerEventId: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  eventType: string;
  state: PaymentState;
  occurredAt: Date;
};
export type GatewayHealth = {
  provider: PaymentProvider;
  environment: string;
  configured: boolean;
  healthy: boolean;
  message: string;
};
export interface PaymentGateway {
  readonly provider: PaymentProvider;
  readonly environment: string;
  createCheckout(
    request: ProviderCheckoutRequest,
  ): Promise<{ providerOrderId: string; checkoutUrl: string }>;
  retrieve(providerOrderId: string): Promise<VerifiedPaymentEvent>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<VerifiedPaymentEvent>;
  health(): Promise<GatewayHealth>;
}

export class DeterministicPaymentGateway implements PaymentGateway {
  readonly provider = 'PAYPAL' as const;
  readonly environment = 'TEST';
  constructor(
    public state: PaymentState = 'AWAITING_CUSTOMER',
    public healthy = true,
  ) {}
  async createCheckout(request: ProviderCheckoutRequest) {
    if (!this.healthy) throw new Error('TEST_PROVIDER_UNAVAILABLE');
    return {
      providerOrderId: `TEST-${request.paymentId}`,
      checkoutUrl: `https://paypal.test/checkout/${request.paymentId}`,
    };
  }
  async retrieve(providerOrderId: string): Promise<VerifiedPaymentEvent> {
    return {
      provider: 'PAYPAL',
      providerEventId: `${providerOrderId}:${this.state}`,
      providerOrderId,
      eventType: 'TEST_RETRIEVAL',
      state: this.state,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    };
  }
  async verifyWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<VerifiedPaymentEvent> {
    const event = body as VerifiedPaymentEvent & { verified?: boolean };
    if (!event.verified) throw new Error('TEST_WEBHOOK_UNVERIFIED');
    return event;
  }
  async health(): Promise<GatewayHealth> {
    return {
      provider: 'PAYPAL',
      environment: this.environment,
      configured: true,
      healthy: this.healthy,
      message: this.healthy ? 'Test gateway healthy.' : 'Test gateway unavailable.',
    };
  }
}

type PayPalOptions = {
  clientId?: string;
  clientSecret?: string;
  webhookId?: string;
  baseUrl?: string;
  environment?: string;
};
function paypalState(status: string): PaymentState {
  if (status === 'COMPLETED') return 'SUCCEEDED';
  if (status === 'APPROVED') return 'PROCESSING';
  if (['VOIDED', 'CANCELLED'].includes(status)) return 'CANCELLED';
  if (['DENIED', 'DECLINED', 'FAILED'].includes(status)) return 'FAILED';
  return 'AWAITING_CUSTOMER';
}

export class PayPalGateway implements PaymentGateway {
  readonly provider = 'PAYPAL' as const;
  readonly environment: string;
  private readonly baseUrl: string;
  constructor(private readonly options: PayPalOptions) {
    this.environment = options.environment ?? 'SANDBOX';
    this.baseUrl = options.baseUrl ?? 'https://api-m.sandbox.paypal.com';
  }
  private async token() {
    if (!this.options.clientId || !this.options.clientSecret)
      throw new Error('PAYPAL_NOT_CONFIGURED');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!response.ok) throw new Error('PAYPAL_AUTH_FAILED');
    return ((await response.json()) as { access_token: string }).access_token;
  }
  async createCheckout(request: ProviderCheckoutRequest) {
    const token = await this.token();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': request.paymentId,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: request.purchaseId,
            custom_id: request.paymentId,
            description: request.description,
            amount: { currency_code: request.currency, value: request.amount },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: request.returnUrl,
              cancel_url: request.cancelUrl,
              user_action: 'PAY_NOW',
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error('PAYPAL_CHECKOUT_FAILED');
    const order = (await response.json()) as {
      id: string;
      links?: Array<{ rel: string; href: string }>;
    };
    const checkoutUrl = order.links?.find(
      ({ rel }) => rel === 'payer-action' || rel === 'approve',
    )?.href;
    if (!order.id || !checkoutUrl) throw new Error('PAYPAL_INVALID_CHECKOUT_RESPONSE');
    return { providerOrderId: order.id, checkoutUrl };
  }
  async retrieve(providerOrderId: string): Promise<VerifiedPaymentEvent> {
    const token = await this.token();
    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error('PAYPAL_RETRIEVE_FAILED');
    let order = (await response.json()) as {
      id: string;
      status: string;
      update_time?: string;
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>;
    };
    if (order.status === 'APPROVED') {
      const capture = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `capture-${providerOrderId}`,
          },
          body: '{}',
        },
      );
      if (!capture.ok) throw new Error('PAYPAL_CAPTURE_FAILED');
      order = (await capture.json()) as typeof order;
    }
    const providerPaymentId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    return {
      provider: 'PAYPAL',
      providerEventId: `paypal-order:${order.id}:${order.status}`,
      providerOrderId: order.id,
      ...(providerPaymentId ? { providerPaymentId } : {}),
      eventType: 'PAYPAL_ORDER_RETRIEVED',
      state: paypalState(order.status),
      occurredAt: new Date(order.update_time ?? Date.now()),
    };
  }
  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<VerifiedPaymentEvent> {
    if (!this.options.webhookId) throw new Error('PAYPAL_NOT_CONFIGURED');
    const token = await this.token();
    const header = (name: string) => {
      const value = headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const response = await fetch(`${this.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: header('paypal-auth-algo'),
        cert_url: header('paypal-cert-url'),
        transmission_id: header('paypal-transmission-id'),
        transmission_sig: header('paypal-transmission-sig'),
        transmission_time: header('paypal-transmission-time'),
        webhook_id: this.options.webhookId,
        webhook_event: body,
      }),
    });
    if (
      !response.ok ||
      ((await response.json()) as { verification_status?: string }).verification_status !==
        'SUCCESS'
    )
      throw new Error('PAYPAL_WEBHOOK_UNVERIFIED');
    const event = body as {
      id?: string;
      event_type?: string;
      create_time?: string;
      resource?: {
        id?: string;
        status?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
      };
    };
    if (!event.id || !event.event_type || !event.resource)
      throw new Error('PAYPAL_WEBHOOK_MALFORMED');
    const orderId =
      event.resource.supplementary_data?.related_ids?.order_id ??
      (event.event_type.startsWith('CHECKOUT.ORDER.') ? event.resource.id : undefined);
    const providerPaymentId = event.event_type.startsWith('PAYMENT.CAPTURE.')
      ? event.resource.id
      : undefined;
    const state =
      event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
        ? 'SUCCEEDED'
        : event.event_type === 'PAYMENT.CAPTURE.DENIED'
          ? 'FAILED'
          : event.event_type === 'CHECKOUT.ORDER.APPROVED'
            ? 'PROCESSING'
            : event.event_type === 'CHECKOUT.ORDER.VOIDED'
              ? 'CANCELLED'
              : 'PENDING';
    return {
      provider: 'PAYPAL',
      providerEventId: event.id,
      ...(orderId ? { providerOrderId: orderId } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
      eventType: event.event_type,
      state,
      occurredAt: new Date(event.create_time ?? Date.now()),
    };
  }
  async health(): Promise<GatewayHealth> {
    if (!this.options.clientId || !this.options.clientSecret || !this.options.webhookId)
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        configured: false,
        healthy: false,
        message: 'PayPal sandbox credentials are not configured.',
      };
    try {
      await this.token();
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        configured: true,
        healthy: true,
        message: 'PayPal authentication succeeded.',
      };
    } catch {
      return {
        provider: 'PAYPAL',
        environment: this.environment,
        configured: true,
        healthy: false,
        message: 'PayPal authentication failed.',
      };
    }
  }
}

export const createPaymentGateway = (source: NodeJS.ProcessEnv = process.env): PaymentGateway =>
  new PayPalGateway({
    ...(source.PAYPAL_CLIENT_ID ? { clientId: source.PAYPAL_CLIENT_ID } : {}),
    ...(source.PAYPAL_CLIENT_SECRET ? { clientSecret: source.PAYPAL_CLIENT_SECRET } : {}),
    ...(source.PAYPAL_WEBHOOK_ID ? { webhookId: source.PAYPAL_WEBHOOK_ID } : {}),
    ...(source.PAYPAL_BASE_URL ? { baseUrl: source.PAYPAL_BASE_URL } : {}),
    ...(source.PAYPAL_ENVIRONMENT ? { environment: source.PAYPAL_ENVIRONMENT } : {}),
  });
