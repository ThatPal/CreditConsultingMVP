-- Sprint 5.1 deterministic synthetic review scenarios.
-- Run only against the Credit Phase 4-5 build-block database after system/demo seed.
DO $$
DECLARE
  review_client UUID;
  review_actor UUID;
  profile_product UUID;
  profile_v1 UUID;
  profile_v2 UUID;
  historical_purchase UUID;
BEGIN
  SELECT c.id, u.id INTO review_client, review_actor
  FROM "Client" c JOIN "User" u ON u.id = c."userId"
  ORDER BY c."createdAt" ASC LIMIT 1;

  SELECT id INTO profile_product FROM "ServiceProduct" WHERE key = 'CREDIT_PROFILE_REVIEW';
  IF review_client IS NULL OR profile_product IS NULL THEN
    RAISE NOTICE 'System/demo seed is required before Sprint 5.1 review scenarios.';
    RETURN;
  END IF;

  SELECT id INTO profile_v1 FROM "ServiceProductVersion"
  WHERE "serviceProductId" = profile_product AND version = 1;

  INSERT INTO "ServiceProductVersion" (
    id, "serviceProductId", version, status, name, description, price, currency,
    "entitlementType", "includedQuantity", "includedReviewCredits", "clientEligibilityCopy"
  ) VALUES (
    gen_random_uuid(), profile_product, 2, 'ACTIVE', 'Credit Profile Review Plus',
    'Current catalog version used to prove historical purchases retain version 1 terms.',
    179.00, 'USD', 'CREDIT_PROFILE_REVIEW', 1, 2,
    'Available to active clients with a current credit profile.'
  ) ON CONFLICT ("serviceProductId", version) DO NOTHING;

  SELECT id INTO profile_v2 FROM "ServiceProductVersion"
  WHERE "serviceProductId" = profile_product AND version = 2;
  UPDATE "ServiceProduct" SET active = true, "currentVersion" = 2, "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = profile_product;

  SELECT id INTO historical_purchase FROM "ServicePurchase"
  WHERE "paymentReference" = 'SYNTHETIC-SPRINT-5.1-HISTORICAL';
  IF historical_purchase IS NULL THEN
    historical_purchase := gen_random_uuid();
    INSERT INTO "ServicePurchase" (
      id, "clientId", "serviceType", "productVersionId", "termsSnapshot", amount,
      currency, status, "paymentReference", "purchasedAt", "createdAt", "updatedAt"
    ) VALUES (
      historical_purchase, review_client, 'CREDIT_PROFILE_REVIEW', profile_v1,
      jsonb_build_object('productKey', 'CREDIT_PROFILE_REVIEW', 'version', 1,
        'name', 'Credit Profile Review', 'description', 'Original frozen terms',
        'amount', '149.00', 'currency', 'USD', 'entitlementType', 'CREDIT_PROFILE_REVIEW',
        'includedQuantity', 1, 'includedReviewCredits', 1),
      149.00, 'USD', 'PAID', 'SYNTHETIC-SPRINT-5.1-HISTORICAL',
      CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP - INTERVAL '30 days', CURRENT_TIMESTAMP
    );
  END IF;

  INSERT INTO "ServiceEntitlement" (
    id, "clientId", "purchaseId", "productVersionId", "sourceKey", "serviceType",
    "quantityGranted", "quantityUsed", status, "updatedAt"
  ) VALUES (
    gen_random_uuid(), review_client, historical_purchase, profile_v1,
    'review:sprint-5.1:entitlement', 'CREDIT_PROFILE_REVIEW', 1, 0, 'ACTIVE', CURRENT_TIMESTAMP
  ) ON CONFLICT ("sourceKey") DO NOTHING;

  INSERT INTO "ReviewCreditTransaction" (
    id, "clientId", "purchaseId", "productVersionId", "sourceKey", "correlationId",
    "transactionType", "availableDelta", reason, "authorizedByUserId"
  ) VALUES (
    gen_random_uuid(), review_client, historical_purchase, profile_v1,
    'review:sprint-5.1:credits', historical_purchase::text, 'PURCHASE', 1,
    'Synthetic Sprint 5.1 included Review Credit', review_actor
  ) ON CONFLICT ("sourceKey") DO NOTHING;
END $$;
