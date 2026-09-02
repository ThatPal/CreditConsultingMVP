CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED');
CREATE TYPE "ReconciliationStatus" AS ENUM ('SUCCEEDED', 'CORRECTED', 'BLOCKED', 'FAILED');

CREATE TABLE "PaymentGatewayConfig" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "provider" "PaymentProvider" NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'SANDBOX', "configured" BOOLEAN NOT NULL DEFAULT false,
  "connected" BOOLEAN NOT NULL DEFAULT false, "enabledForNewPayments" BOOLEAN NOT NULL DEFAULT false,
  "defaultForCheckout" BOOLEAN NOT NULL DEFAULT false, "status" "IntegrationStatus" NOT NULL DEFAULT 'UNTESTED',
  "configurationMetadata" JSONB, "secretReferences" TEXT[], "lastTestedAt" TIMESTAMPTZ(3),
  "lastSuccessAt" TIMESTAMPTZ(3), "lastErrorCategory" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PaymentGatewayConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentGatewayConfig_provider_key" ON "PaymentGatewayConfig"("provider");
CREATE INDEX "PaymentGatewayConfig_enabledForNewPayments_defaultForCheckout_idx" ON "PaymentGatewayConfig"("enabledForNewPayments", "defaultForCheckout");
CREATE UNIQUE INDEX "PaymentGatewayConfig_single_default" ON "PaymentGatewayConfig"("defaultForCheckout") WHERE "defaultForCheckout" = true;
ALTER TABLE "PaymentGatewayConfig" ADD CONSTRAINT "PaymentGatewayConfig_default_requires_enabled" CHECK (NOT "defaultForCheckout" OR "enabledForNewPayments");

CREATE TABLE "PaymentRefund" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "paymentId" UUID NOT NULL, "purchaseId" UUID NOT NULL,
  "clientId" UUID NOT NULL, "provider" "PaymentProvider" NOT NULL, "providerRefundId" TEXT,
  "idempotencyKey" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED', "reason" TEXT, "actorId" UUID,
  "source" TEXT NOT NULL DEFAULT 'ADMIN', "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRefund_paymentId_idempotencyKey_key" ON "PaymentRefund"("paymentId", "idempotencyKey");
CREATE UNIQUE INDEX "PaymentRefund_provider_providerRefundId_key" ON "PaymentRefund"("provider", "providerRefundId");
CREATE INDEX "PaymentRefund_paymentId_status_createdAt_idx" ON "PaymentRefund"("paymentId", "status", "createdAt");
CREATE INDEX "PaymentRefund_clientId_createdAt_idx" ON "PaymentRefund"("clientId", "createdAt");
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentDispute" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "paymentId" UUID NOT NULL, "clientId" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL, "providerDisputeId" TEXT NOT NULL, "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "amount" DECIMAL(12,2), "currency" TEXT, "reason" TEXT, "category" TEXT, "evidenceDueAt" TIMESTAMPTZ(3),
  "providerOccurredAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "PaymentDispute_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentDispute_provider_providerDisputeId_key" ON "PaymentDispute"("provider", "providerDisputeId");
CREATE INDEX "PaymentDispute_paymentId_status_createdAt_idx" ON "PaymentDispute"("paymentId", "status", "createdAt");
ALTER TABLE "PaymentDispute" ADD CONSTRAINT "PaymentDispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PaymentReconciliation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "paymentId" UUID NOT NULL, "provider" "PaymentProvider" NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "status" "ReconciliationStatus" NOT NULL, "beforeState" "PaymentState" NOT NULL,
  "providerState" "PaymentState", "corrected" BOOLEAN NOT NULL DEFAULT false, "errorCode" TEXT, "actorId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentReconciliation_paymentId_idempotencyKey_key" ON "PaymentReconciliation"("paymentId", "idempotencyKey");
CREATE INDEX "PaymentReconciliation_paymentId_createdAt_idx" ON "PaymentReconciliation"("paymentId", "createdAt");
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
