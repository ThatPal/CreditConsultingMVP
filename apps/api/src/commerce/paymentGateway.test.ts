import { describe, expect, test } from 'vitest';
import Stripe from 'stripe';
import {
  DeterministicPaymentGateway,
  PaymentGatewayRegistry,
  StripeGateway,
} from './paymentGateway.js';
import { permitsPaymentTransition } from './paymentService.js';

describe('provider-neutral payment contract', () => {
  test('offers deterministic checkout and authoritative retrieval without exposing secrets', async () => {
    const gateway = new DeterministicPaymentGateway('SUCCEEDED');
    const checkout = await gateway.createCheckout({
      paymentId: 'payment-1',
      purchaseId: 'purchase-1',
      amount: '49.00',
      currency: 'USD',
      description: 'Review',
      returnUrl: 'http://credit.test/return',
      cancelUrl: 'http://credit.test/cancel',
    });
    expect(checkout).toEqual({
      providerOrderId: 'TEST-payment-1',
      checkoutUrl: 'https://paypal.test/checkout/payment-1',
    });
    expect(await gateway.retrieve(checkout.providerOrderId)).toMatchObject({
      state: 'SUCCEEDED',
      provider: 'PAYPAL',
    });
    expect(JSON.stringify(await gateway.health())).not.toMatch(/secret|client.?id|credential/i);
  });
  test('fails closed on an unverified event', async () => {
    await expect(
      new DeterministicPaymentGateway().verifyWebhook({}, { providerEventId: 'forged' }),
    ).rejects.toThrow('TEST_WEBHOOK_UNVERIFIED');
  });
  test('canonical transitions are monotonic and browser-like terminal regressions are denied', () => {
    expect(permitsPaymentTransition('AWAITING_CUSTOMER', 'PROCESSING')).toBe(true);
    expect(permitsPaymentTransition('PROCESSING', 'SUCCEEDED')).toBe(true);
    expect(permitsPaymentTransition('SUCCEEDED', 'FAILED')).toBe(false);
    expect(permitsPaymentTransition('CANCELLED', 'SUCCEEDED')).toBe(false);
    expect(permitsPaymentTransition('SUCCEEDED', 'SUCCEEDED')).toBe(false);
  });
  test('Stripe uses official signature verification and normalizes paid Checkout truth', async () => {
    const webhookSecret = 'whsec_sprint53_test_only';
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: 'evt_stripe_paid',
      object: 'event',
      type: 'checkout.session.completed',
      created: timestamp,
      data: {
        object: {
          id: 'cs_test_paid',
          object: 'checkout.session',
          created: timestamp,
          status: 'complete',
          payment_status: 'paid',
          payment_intent: 'pi_test_paid',
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
      timestamp,
    });
    const gateway = new StripeGateway({
      secretKey: 'sk_test_not_a_real_key',
      webhookSecret,
    });
    await expect(
      gateway.verifyWebhook({ 'stripe-signature': signature }, Buffer.from(payload)),
    ).resolves.toMatchObject({
      provider: 'STRIPE',
      providerEventId: 'evt_stripe_paid',
      providerOrderId: 'cs_test_paid',
      providerPaymentId: 'pi_test_paid',
      state: 'SUCCEEDED',
    });
    await expect(
      gateway.verifyWebhook({ 'stripe-signature': `${signature}forged` }, Buffer.from(payload)),
    ).rejects.toThrow();
    expect(JSON.stringify(await new StripeGateway({}).health())).not.toMatch(
      /sk_test|whsec|secret.?key|webhook.?secret/i,
    );
  });
  test('registry governs the default provider without changing shared gateway behavior', () => {
    const paypal = new DeterministicPaymentGateway('AWAITING_CUSTOMER', true, 'PAYPAL');
    const stripe = new DeterministicPaymentGateway('AWAITING_CUSTOMER', true, 'STRIPE');
    const registry = new PaymentGatewayRegistry([paypal, stripe], 'STRIPE');
    expect(registry.getDefault()).toBe(stripe);
    expect(registry.get('PAYPAL')).toBe(paypal);
  });
});
