import type { PaymentProvider, PaymentState } from '../generated/prisma/client.js';
import Stripe from 'stripe';

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

export class PaymentGatewayRegistry {
  private readonly gateways: Map<PaymentProvider, PaymentGateway>;
  constructor(
    gateways: PaymentGateway[],
    readonly defaultProvider: PaymentProvider,
  ) {
    this.gateways = new Map(gateways.map((gateway) => [gateway.provider, gateway]));
    if (!this.gateways.has(defaultProvider)) throw new Error('DEFAULT_PAYMENT_PROVIDER_MISSING');
  }
  get(provider: PaymentProvider) {
    const gateway = this.gateways.get(provider);
    if (!gateway) throw new Error('PAYMENT_PROVIDER_NOT_AVAILABLE');
    return gateway;
  }
  getDefault() {
    return this.get(this.defaultProvider);
  }
  list() {
    return [...this.gateways.values()];
  }
}

export class DeterministicPaymentGateway implements PaymentGateway {
  readonly provider: PaymentProvider;
  readonly environment = 'TEST';
  constructor(
    public state: PaymentState = 'AWAITING_CUSTOMER',
    public healthy = true,
    provider: PaymentProvider = 'PAYPAL',
  ) {
    this.provider = provider;
  }
  async createCheckout(request: ProviderCheckoutRequest) {
    if (!this.healthy) throw new Error('TEST_PROVIDER_UNAVAILABLE');
    return {
      providerOrderId: `TEST-${request.paymentId}`,
      checkoutUrl: `https://${this.provider.toLowerCase()}.test/checkout/${request.paymentId}`,
    };
  }
  async retrieve(providerOrderId: string): Promise<VerifiedPaymentEvent> {
    return {
      provider: this.provider,
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

export type StripeOptions = {
  secretKey?: string;
  webhookSecret?: string;
  environment?: string;
};

function stripeState(session: { status?: string | null; payment_status?: string | null }) {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')
    return 'SUCCEEDED' as const;
  if (session.status === 'expired') return 'CANCELLED' as const;
  if (session.status === 'complete') return 'PROCESSING' as const;
  return 'AWAITING_CUSTOMER' as const;
}

export class StripeGateway implements PaymentGateway {
  readonly provider = 'STRIPE' as const;
  readonly environment: string;
  private readonly client: Stripe | undefined;
  constructor(private readonly options: StripeOptions) {
    this.environment = options.environment ?? 'TEST';
    this.client = options.secretKey ? new Stripe(options.secretKey) : undefined;
  }
  private configuredClient() {
    if (!this.client) throw new Error('STRIPE_NOT_CONFIGURED');
    return this.client;
  }
  async createCheckout(request: ProviderCheckoutRequest) {
    const session = await this.configuredClient().checkout.sessions.create(
      {
        mode: 'payment',
        client_reference_id: request.paymentId,
        metadata: { paymentId: request.paymentId, purchaseId: request.purchaseId },
        payment_intent_data: {
          metadata: { paymentId: request.paymentId, purchaseId: request.purchaseId },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: request.currency.toLowerCase(),
              unit_amount: Math.round(Number(request.amount) * 100),
              product_data: { name: request.description },
            },
          },
        ],
        success_url: request.returnUrl,
        cancel_url: request.cancelUrl,
      },
      { idempotencyKey: request.paymentId },
    );
    if (!session.url) throw new Error('STRIPE_INVALID_CHECKOUT_RESPONSE');
    return { providerOrderId: session.id, checkoutUrl: session.url };
  }
  async retrieve(providerOrderId: string): Promise<VerifiedPaymentEvent> {
    const session = await this.configuredClient().checkout.sessions.retrieve(providerOrderId);
    const providerPaymentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    return {
      provider: 'STRIPE',
      providerEventId: `stripe-session:${session.id}:${session.status}:${session.payment_status}`,
      providerOrderId: session.id,
      ...(providerPaymentId ? { providerPaymentId } : {}),
      eventType: 'STRIPE_CHECKOUT_SESSION_RETRIEVED',
      state: stripeState(session),
      occurredAt: new Date(session.created * 1000),
    };
  }
  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<VerifiedPaymentEvent> {
    if (!this.options.webhookSecret) throw new Error('STRIPE_NOT_CONFIGURED');
    const signature = headers['stripe-signature'];
    if (typeof signature !== 'string' || !Buffer.isBuffer(body))
      throw new Error('STRIPE_WEBHOOK_MALFORMED');
    const event = this.configuredClient().webhooks.constructEvent(
      body,
      signature,
      this.options.webhookSecret,
    );
    const object = event.data.object;
    let providerOrderId: string | undefined;
    let providerPaymentId: string | undefined;
    let state: PaymentState;
    if (object.object === 'checkout.session') {
      providerOrderId = object.id;
      providerPaymentId =
        typeof object.payment_intent === 'string'
          ? object.payment_intent
          : object.payment_intent?.id;
      state =
        event.type === 'checkout.session.async_payment_failed' ? 'FAILED' : stripeState(object);
    } else if (object.object === 'payment_intent') {
      providerPaymentId = object.id;
      state =
        object.status === 'succeeded'
          ? 'SUCCEEDED'
          : object.status === 'processing'
            ? 'PROCESSING'
            : object.status === 'canceled'
              ? 'CANCELLED'
              : object.status === 'requires_payment_method'
                ? 'FAILED'
                : 'PENDING';
    } else {
      throw new Error('STRIPE_WEBHOOK_UNSUPPORTED');
    }
    return {
      provider: 'STRIPE',
      providerEventId: event.id,
      ...(providerOrderId ? { providerOrderId } : {}),
      ...(providerPaymentId ? { providerPaymentId } : {}),
      eventType: event.type,
      state,
      occurredAt: new Date(event.created * 1000),
    };
  }
  async health(): Promise<GatewayHealth> {
    if (!this.options.secretKey || !this.options.webhookSecret)
      return {
        provider: 'STRIPE',
        environment: this.environment,
        configured: false,
        healthy: false,
        message: 'Stripe test credentials are not configured.',
      };
    try {
      await this.configuredClient().balance.retrieve();
      return {
        provider: 'STRIPE',
        environment: this.environment,
        configured: true,
        healthy: true,
        message: 'Stripe authentication succeeded.',
      };
    } catch {
      return {
        provider: 'STRIPE',
        environment: this.environment,
        configured: true,
        healthy: false,
        message: 'Stripe authentication failed.',
      };
    }
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

export const createPaymentGatewayRegistry = (
  source: NodeJS.ProcessEnv = process.env,
): PaymentGatewayRegistry => {
  const paypal = createPaymentGateway(source);
  const stripe = new StripeGateway({
    ...(source.STRIPE_SECRET_KEY ? { secretKey: source.STRIPE_SECRET_KEY } : {}),
    ...(source.STRIPE_WEBHOOK_SECRET ? { webhookSecret: source.STRIPE_WEBHOOK_SECRET } : {}),
    ...(source.STRIPE_ENVIRONMENT ? { environment: source.STRIPE_ENVIRONMENT } : {}),
  });
  const requested = source.PAYMENT_DEFAULT_PROVIDER === 'STRIPE' ? 'STRIPE' : 'PAYPAL';
  return new PaymentGatewayRegistry([paypal, stripe], requested);
};
