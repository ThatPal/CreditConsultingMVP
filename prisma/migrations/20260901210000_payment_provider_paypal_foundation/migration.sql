ALTER TYPE "PaymentState" ADD VALUE IF NOT EXISTS 'AWAITING_CUSTOMER';
ALTER TYPE "PaymentState" ADD VALUE IF NOT EXISTS 'PROCESSING';

CREATE TYPE "PaymentEventDisposition" AS ENUM ('APPLIED', 'DUPLICATE', 'IGNORED');

ALTER TABLE "Payment"
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "providerEnvironment" TEXT NOT NULL DEFAULT 'SANDBOX',
  ADD COLUMN "lastErrorCode" TEXT;

CREATE TABLE "PaymentProviderEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" "PaymentProvider" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "disposition" "PaymentEventDisposition" NOT NULL DEFAULT 'APPLIED',
  "normalizedState" "PaymentState",
  "paymentId" UUID,
  "actorId" UUID,
  "safeMetadata" JSONB,
  "occurredAt" TIMESTAMPTZ(3),
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentProviderEvent_provider_providerEventId_key" ON "PaymentProviderEvent"("provider", "providerEventId");
CREATE INDEX "PaymentProviderEvent_paymentId_createdAt_idx" ON "PaymentProviderEvent"("paymentId", "createdAt");
CREATE INDEX "PaymentProviderEvent_provider_createdAt_idx" ON "PaymentProviderEvent"("provider", "createdAt");
CREATE INDEX "Payment_provider_providerOrderId_idx" ON "Payment"("provider", "providerOrderId");
CREATE INDEX "Payment_provider_providerPaymentId_idx" ON "Payment"("provider", "providerPaymentId");

ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
