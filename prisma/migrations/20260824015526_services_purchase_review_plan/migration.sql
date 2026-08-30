-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CREDIT_PROFILE_REVIEW', 'CREDIT_CARD_ROUND', 'MAJOR_APPLICATION_READINESS');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PAYPAL', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewFrequency" AS ENUM ('SEMIANNUAL', 'QUARTERLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReviewPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ServicePurchase" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paymentProvider" "PaymentProvider" NOT NULL,
    "paymentReference" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPlan" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "frequency" "ReviewFrequency" NOT NULL,
    "status" "ReviewPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentProvider" "PaymentProvider" NOT NULL,
    "providerSubscriptionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextReviewAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePurchase_clientId_createdAt_idx" ON "ServicePurchase"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ServicePurchase_status_serviceType_idx" ON "ServicePurchase"("status", "serviceType");

-- CreateIndex
CREATE INDEX "ReviewPlan_clientId_status_idx" ON "ReviewPlan"("clientId", "status");

-- AddForeignKey
ALTER TABLE "ServicePurchase" ADD CONSTRAINT "ServicePurchase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPlan" ADD CONSTRAINT "ReviewPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
