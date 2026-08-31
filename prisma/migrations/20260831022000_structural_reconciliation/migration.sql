-- Sprint 0.2 is intentionally additive. Legacy values and columns remain readable
-- until their documented removal conditions are satisfied.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'STRIPE';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'BOFA_MERCHANT';

CREATE TYPE "StorageProvider" AS ENUM ('LOCAL_DISK', 'S3_COMPATIBLE');
CREATE TYPE "ClientBusinessStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FinancialRelationshipStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'RESERVED', 'CONSUMED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "ReviewCreditTransactionType" AS ENUM ('PURCHASE', 'RESERVE', 'RELEASE_RESERVATION', 'CONSUME', 'RESTORE', 'EXPIRE', 'ADMIN_ADJUSTMENT');
CREATE TYPE "PaymentState" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "PlanActionKind" AS ENUM ('ACTION', 'GUIDANCE', 'MILESTONE');
CREATE TYPE "WorkItemAuthority" AS ENUM ('PLAN_PROJECTION', 'LEGACY_INDEPENDENT');

ALTER TABLE "ApplicationCycle" ADD COLUMN "season" TEXT,
ADD COLUMN "year" INTEGER,
ADD COLUMN "displayName" TEXT;
ALTER TABLE "CreditReportDocument" ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL_DISK';
ALTER TABLE "PlanAction" ADD COLUMN "kind" "PlanActionKind" NOT NULL DEFAULT 'ACTION';
ALTER TABLE "WorkItem" ADD COLUMN "authority" "WorkItemAuthority" NOT NULL DEFAULT 'LEGACY_INDEPENDENT',
ADD COLUMN "planActionId" UUID;

CREATE TABLE "ClientBusiness" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL,
  "legalName" TEXT NOT NULL, "displayName" TEXT, "entityType" TEXT, "industry" TEXT,
  "formedAt" TIMESTAMP(3), "ownershipPercent" DECIMAL(5,2),
  "status" "ClientBusinessStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientBusiness_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClientFinancialRelationship" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "clientBusinessId" UUID,
  "institutionName" TEXT NOT NULL, "relationshipType" TEXT NOT NULL,
  "relationshipStartedAt" TIMESTAMP(3), "approximateTenure" TEXT,
  "status" "FinancialRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
  "clientNote" TEXT, "source" TEXT, "lastConfirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientFinancialRelationship_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceEntitlement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "purchaseId" UUID,
  "serviceType" "ServiceType" NOT NULL, "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reservedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReviewCreditTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "purchaseId" UUID, "reviewId" UUID,
  "transactionType" "ReviewCreditTransactionType" NOT NULL,
  "availableDelta" INTEGER NOT NULL DEFAULT 0, "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "consumedDelta" INTEGER NOT NULL DEFAULT 0, "expiredDelta" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT, "authorizedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewCreditTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "purchaseId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL, "state" "PaymentState" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'USD',
  "providerPaymentId" TEXT, "providerOrderId" TEXT, "providerCustomerId" TEXT,
  "verifiedProviderEventId" TEXT, "occurredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientBusiness_clientId_status_idx" ON "ClientBusiness"("clientId", "status");
CREATE INDEX "ClientFinancialRelationship_clientId_status_institutionName_idx" ON "ClientFinancialRelationship"("clientId", "status", "institutionName");
CREATE INDEX "ClientFinancialRelationship_clientBusinessId_idx" ON "ClientFinancialRelationship"("clientBusinessId");
CREATE INDEX "ServiceEntitlement_clientId_serviceType_status_idx" ON "ServiceEntitlement"("clientId", "serviceType", "status");
CREATE INDEX "ServiceEntitlement_purchaseId_idx" ON "ServiceEntitlement"("purchaseId");
CREATE INDEX "ReviewCreditTransaction_clientId_createdAt_idx" ON "ReviewCreditTransaction"("clientId", "createdAt");
CREATE INDEX "ReviewCreditTransaction_purchaseId_idx" ON "ReviewCreditTransaction"("purchaseId");
CREATE INDEX "ReviewCreditTransaction_reviewId_idx" ON "ReviewCreditTransaction"("reviewId");
CREATE UNIQUE INDEX "Payment_provider_verifiedProviderEventId_key" ON "Payment"("provider", "verifiedProviderEventId");
CREATE INDEX "Payment_purchaseId_createdAt_idx" ON "Payment"("purchaseId", "createdAt");
CREATE INDEX "Payment_clientId_state_createdAt_idx" ON "Payment"("clientId", "state", "createdAt");
CREATE INDEX "WorkItem_planActionId_status_idx" ON "WorkItem"("planActionId", "status");

ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_planActionId_fkey" FOREIGN KEY ("planActionId") REFERENCES "PlanAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientBusiness" ADD CONSTRAINT "ClientBusiness_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientFinancialRelationship" ADD CONSTRAINT "ClientFinancialRelationship_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientFinancialRelationship" ADD CONSTRAINT "ClientFinancialRelationship_clientBusinessId_fkey" FOREIGN KEY ("clientBusinessId") REFERENCES "ClientBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceEntitlement" ADD CONSTRAINT "ServiceEntitlement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceEntitlement" ADD CONSTRAINT "ServiceEntitlement_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCreditTransaction" ADD CONSTRAINT "ReviewCreditTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCreditTransaction" ADD CONSTRAINT "ReviewCreditTransaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewCreditTransaction" ADD CONSTRAINT "ReviewCreditTransaction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve historical purchases without manufacturing financial attempts.
-- Paid Review purchases receive one available Review Credit; future verified
-- payment handlers append credits based on the purchased package quantity.
INSERT INTO "ReviewCreditTransaction" ("clientId", "purchaseId", "transactionType", "availableDelta", "reason")
SELECT "clientId", "id", 'PURCHASE', 1, 'Sprint 0.2 legacy paid Review purchase backfill'
FROM "ServicePurchase"
WHERE "serviceType" = 'CREDIT_PROFILE_REVIEW' AND "status" = 'PAID';

INSERT INTO "ServiceEntitlement" ("clientId", "purchaseId", "serviceType", "status", "updatedAt")
SELECT "clientId", "id", "serviceType", 'ACTIVE', CURRENT_TIMESTAMP
FROM "ServicePurchase"
WHERE "serviceType" <> 'CREDIT_PROFILE_REVIEW' AND "status" = 'PAID';
