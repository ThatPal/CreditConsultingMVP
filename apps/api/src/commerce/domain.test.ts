import { describe, expect, test } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { deriveReviewCreditBalance, frozenTerms, validateActivatableProduct } from './domain.js';

describe('commerce foundations', () => {
  test('freezes exact version terms and preserves decimal precision', () => {
    const version = {
      version: 1,
      name: 'Original review',
      description: 'Original terms',
      price: new Prisma.Decimal('149.10'),
      currency: 'USD',
      entitlementType: 'CREDIT_PROFILE_REVIEW',
      includedQuantity: 1,
      includedReviewCredits: 2,
    };
    const snapshot = frozenTerms('CREDIT_PROFILE_REVIEW', version);
    version.name = 'Changed catalog name';
    version.price = new Prisma.Decimal('999.00');
    expect(snapshot).toMatchObject({ name: 'Original review', amount: '149.10', version: 1 });
  });

  test('derives balances from the append-only ledger', () => {
    expect(
      deriveReviewCreditBalance([
        { availableDelta: 5, reservedDelta: 0, consumedDelta: 0, expiredDelta: 0 },
        { availableDelta: -2, reservedDelta: 2, consumedDelta: 0, expiredDelta: 0 },
        { availableDelta: 0, reservedDelta: -1, consumedDelta: 1, expiredDelta: 0 },
      ]),
    ).toEqual({ available: 3, reserved: 1, consumed: 1, expired: 0 });
  });

  test('blocks activation when commercial terms are incomplete', () => {
    expect(
      validateActivatableProduct({
        name: '',
        description: '',
        price: new Prisma.Decimal('-1'),
        currency: 'usd',
        entitlementType: null,
        includedQuantity: 0,
        includedReviewCredits: -1,
      }),
    ).toHaveLength(7);
  });
});
