import { describe, expect, test } from 'vitest';
import Stripe from 'stripe';
import {
  DeterministicPaymentGateway,
  BankOfAmericaGateway,
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
  test('deterministic health reports its instantiated provider', async () => {
    await expect(
      new DeterministicPaymentGateway('AWAITING_CUSTOMER', true, 'STRIPE').health(),
    ).resolves.toMatchObject({ provider: 'STRIPE' });
    await expect(
      new DeterministicPaymentGateway('AWAITING_CUSTOMER', true, 'BOFA_MERCHANT').health(),
    ).resolves.toMatchObject({ provider: 'BOFA_MERCHANT' });
  });
  test('BofA hosted checkout signs canonical fields and verifies merchant notifications', async () => {
    const secretKey = 'sprint54-test-secret';
    const gateway = new BankOfAmericaGateway({
      accessKey: 'sprint54-access',
      profileId: 'sprint54-profile',
      secretKey,
    });
    const checkout = await gateway.createCheckout({
      paymentId: 'payment-bofa',
      purchaseId: 'purchase-bofa',
      amount: '51.00',
      currency: 'USD',
      description: 'Canonical service',
      returnUrl: 'https://credit.test/return',
      cancelUrl: 'https://credit.test/cancel',
    });
    expect(checkout).toMatchObject({
      providerOrderId: 'payment-bofa',
      method: 'POST',
      checkoutUrl: 'https://testsecureacceptance.cybersource.com/pay',
    });
    expect(checkout.formFields).toMatchObject({
      amount: '51.00',
      currency: 'USD',
      reference_number: 'payment-bofa',
      merchant_defined_data1: 'purchase-bofa',
    });
    expect(JSON.stringify(checkout)).not.toContain(secretKey);

    const notification: Record<string, string> = {
      transaction_uuid: 'payment-bofa',
      decision: 'ACCEPT',
      request_id: 'bofa-event-1',
      reason_code: '100',
      signed_field_names: 'transaction_uuid,decision,request_id,reason_code,signed_field_names',
    };
    const data = notification.signed_field_names
      .split(',')
      .map((name) => `${name}=${notification[name]}`)
      .join(',');
    notification.signature = createHmac('sha256', secretKey).update(data).digest('base64');
    await expect(gateway.verifyWebhook({}, notification)).resolves.toMatchObject({
      provider: 'BOFA_MERCHANT',
      providerOrderId: 'payment-bofa',
      providerEventId: 'bofa-event-1',
      state: 'SUCCEEDED',
    });
    await expect(
      gateway.verifyWebhook({}, { ...notification, signature: `${notification.signature}forged` }),
    ).rejects.toThrow('BOFA_NOTIFICATION_UNVERIFIED');
    await expect(new BankOfAmericaGateway({}).health()).resolves.toMatchObject({
      provider: 'BOFA_MERCHANT',
      configured: false,
      healthy: false,
      capabilities: { statusRetrieval: false, refund: 'UNSUPPORTED' },
    });
  });
});
import { createHmac } from 'node:crypto';
