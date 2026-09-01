import { describe, expect, test } from 'vitest';
import { DeterministicPaymentGateway } from './paymentGateway.js';
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
});
