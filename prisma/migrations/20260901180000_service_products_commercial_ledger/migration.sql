CREATE TYPE "ServiceProductVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TABLE "ServiceProduct" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "currentVersion" INTEGER,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ServiceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceProductVersion" (
  "id" UUID NOT NULL,
  "serviceProductId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ServiceProductVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "entitlementType" "ServiceType" NOT NULL,
  "includedQuantity" INTEGER NOT NULL DEFAULT 1,
  "includedReviewCredits" INTEGER NOT NULL DEFAULT 0,
  "prerequisiteCode" TEXT,
  "clientEligibilityCopy" TEXT,
  "effectiveAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceProductVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServicePurchase"
  ADD COLUMN "productVersionId" UUID,
  ADD COLUMN "termsSnapshot" JSONB,
  ALTER COLUMN "paymentProvider" DROP NOT NULL;

ALTER TABLE "ServiceEntitlement"
  ADD COLUMN "productVersionId" UUID,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "quantityGranted" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "quantityUsed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ReviewCreditTransaction"
  ADD COLUMN "productVersionId" UUID,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "correlationId" TEXT;

CREATE UNIQUE INDEX "ServiceProduct_key_key" ON "ServiceProduct"("key");
CREATE INDEX "ServiceProduct_active_updatedAt_idx" ON "ServiceProduct"("active", "updatedAt");
CREATE UNIQUE INDEX "ServiceProductVersion_serviceProductId_version_key" ON "ServiceProductVersion"("serviceProductId", "version");
CREATE INDEX "ServiceProductVersion_status_effectiveAt_idx" ON "ServiceProductVersion"("status", "effectiveAt");
CREATE INDEX "ServiceProductVersion_entitlementType_idx" ON "ServiceProductVersion"("entitlementType");
CREATE INDEX "ServicePurchase_productVersionId_createdAt_idx" ON "ServicePurchase"("productVersionId", "createdAt");
CREATE UNIQUE INDEX "ServiceEntitlement_sourceKey_key" ON "ServiceEntitlement"("sourceKey");
CREATE INDEX "ServiceEntitlement_productVersionId_idx" ON "ServiceEntitlement"("productVersionId");
CREATE UNIQUE INDEX "ReviewCreditTransaction_sourceKey_key" ON "ReviewCreditTransaction"("sourceKey");
CREATE INDEX "ReviewCreditTransaction_productVersionId_idx" ON "ReviewCreditTransaction"("productVersionId");
CREATE INDEX "ReviewCreditTransaction_correlationId_idx" ON "ReviewCreditTransaction"("correlationId");

ALTER TABLE "ServiceProductVersion" ADD CONSTRAINT "ServiceProductVersion_serviceProductId_fkey" FOREIGN KEY ("serviceProductId") REFERENCES "ServiceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePurchase" ADD CONSTRAINT "ServicePurchase_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ServiceProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceEntitlement" ADD CONSTRAINT "ServiceEntitlement_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ServiceProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCreditTransaction" ADD CONSTRAINT "ReviewCreditTransaction_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ServiceProductVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ServiceProduct" ("id", "key", "active", "currentVersion", "createdAt", "updatedAt")
SELECT gen_random_uuid(), definition."serviceType"::text, definition.active, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ServiceDefinition" definition;

INSERT INTO "ServiceProductVersion" (
  "id", "serviceProductId", "version", "status", "name", "description", "price", "currency",
  "entitlementType", "includedQuantity", "includedReviewCredits", "prerequisiteCode", "clientEligibilityCopy", "effectiveAt", "createdAt"
)
SELECT gen_random_uuid(), product.id, 1,
       CASE WHEN product.active THEN 'ACTIVE'::"ServiceProductVersionStatus" ELSE 'DRAFT'::"ServiceProductVersionStatus" END,
       CASE definition."serviceType"
         WHEN 'CREDIT_PROFILE_REVIEW' THEN 'Credit Profile Review'
         WHEN 'CREDIT_CARD_ROUND' THEN 'Optimized Credit Card Round'
         ELSE 'Major Credit Application Readiness'
       END,
       CASE definition."serviceType"
         WHEN 'CREDIT_PROFILE_REVIEW' THEN 'A consultant-led review of the client credit profile and next actions.'
         WHEN 'CREDIT_CARD_ROUND' THEN 'A coordinated credit-card application service available after required preparation.'
         ELSE 'Readiness guidance for a planned major credit application.'
       END,
       definition.price, definition.currency, definition."serviceType", 1,
       CASE WHEN definition."serviceType" = 'CREDIT_PROFILE_REVIEW' THEN 1 ELSE 0 END,
       CASE WHEN definition."serviceType" = 'CREDIT_PROFILE_REVIEW' THEN NULL ELSE 'CURRENT_CREDIT_PROFILE' END,
       CASE WHEN definition."serviceType" = 'CREDIT_PROFILE_REVIEW' THEN 'Available without a current profile.' ELSE 'A current credit profile is required.' END,
       CASE WHEN product.active THEN CURRENT_TIMESTAMP ELSE NULL END, CURRENT_TIMESTAMP
FROM "ServiceDefinition" definition
JOIN "ServiceProduct" product ON product.key = definition."serviceType"::text;

UPDATE "ServicePurchase" purchase
SET "productVersionId" = version.id,
    "termsSnapshot" = jsonb_build_object(
      'productKey', product.key,
      'version', version.version,
      'name', version.name,
      'description', version.description,
      'amount', purchase.amount,
      'currency', purchase.currency,
      'entitlementType', version."entitlementType",
      'includedQuantity', version."includedQuantity",
      'includedReviewCredits', version."includedReviewCredits"
    )
FROM "ServiceProductVersion" version
JOIN "ServiceProduct" product ON product.id = version."serviceProductId"
WHERE product.key = purchase."serviceType"::text AND version.version = 1;

UPDATE "ServiceEntitlement" entitlement
SET "productVersionId" = purchase."productVersionId",
    "sourceKey" = CASE WHEN entitlement."purchaseId" IS NULL THEN NULL ELSE 'legacy-entitlement:' || entitlement.id::text END
FROM "ServicePurchase" purchase
WHERE purchase.id = entitlement."purchaseId";

UPDATE "ReviewCreditTransaction" transaction
SET "productVersionId" = purchase."productVersionId",
    "sourceKey" = CASE WHEN transaction."purchaseId" IS NULL THEN NULL ELSE 'legacy-review-credit:' || transaction.id::text END
FROM "ServicePurchase" purchase
WHERE purchase.id = transaction."purchaseId";
