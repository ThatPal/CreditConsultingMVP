-- CreateEnum
CREATE TYPE "CreditReviewStatus" AS ENUM ('PURCHASED', 'INTAKE_REQUIRED', 'INFORMATION_RECEIVED', 'CONSULTANT_REVIEW', 'COMPLETE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GeneralReadiness" AS ENUM ('NEEDS_REVIEW', 'UNDER_REVIEW', 'HIGH', 'MEDIUM', 'LOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReviewRecommendation" AS ENUM ('PROCEED', 'PROCEED_SELECTIVELY', 'PREPARE_FIRST', 'WAIT_NURTURE', 'MAJOR_APPLICATION_PRIORITY');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('POSITIVE', 'INFORMATIONAL', 'CAUTION', 'CRITICAL');

-- AlterTable
ALTER TABLE "CreditSnapshot" ADD COLUMN     "averageAccountAgeMonths" INTEGER,
ADD COLUMN     "equifaxScore" INTEGER,
ADD COLUMN     "experianScore" INTEGER,
ADD COLUMN     "transunionScore" INTEGER;

-- CreateTable
CREATE TABLE "CreditReview" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "purchaseId" UUID,
    "consultantId" UUID,
    "status" "CreditReviewStatus" NOT NULL DEFAULT 'INTAKE_REQUIRED',
    "generalReadiness" "GeneralReadiness" NOT NULL DEFAULT 'UNDER_REVIEW',
    "recommendation" "ReviewRecommendation",
    "readinessExpiresAt" TIMESTAMP(3),
    "nextReviewRecommendedAt" TIMESTAMP(3),
    "clientSummary" TEXT,
    "internalNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "snapshotId" UUID,

    CONSTRAINT "CreditReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewIntake" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "reportDocumentKey" TEXT,
    "reportSource" TEXT,
    "reportDate" TIMESTAMP(3),
    "recentApplications" JSONB,
    "materialChanges" JSONB,
    "clientConfirmedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewFinding" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "optionId" UUID,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "severity" "FindingSeverity" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditAccountSnapshot" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "creditorName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3),
    "creditLimit" DECIMAL(14,2),
    "balance" DECIMAL(14,2),
    "paymentStatus" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CreditAccountSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditReview_purchaseId_key" ON "CreditReview"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReview_snapshotId_key" ON "CreditReview"("snapshotId");

-- CreateIndex
CREATE INDEX "CreditReview_clientId_status_createdAt_idx" ON "CreditReview"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CreditReview_consultantId_status_updatedAt_idx" ON "CreditReview"("consultantId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewIntake_reviewId_key" ON "ReviewIntake"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewFinding_reviewId_sortOrder_idx" ON "ReviewFinding"("reviewId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewFinding_reviewId_code_key" ON "ReviewFinding"("reviewId", "code");

-- CreateIndex
CREATE INDEX "CreditAccountSnapshot_snapshotId_creditorName_idx" ON "CreditAccountSnapshot"("snapshotId", "creditorName");

-- AddForeignKey
ALTER TABLE "CreditReview" ADD CONSTRAINT "CreditReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReview" ADD CONSTRAINT "CreditReview_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReview" ADD CONSTRAINT "CreditReview_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReview" ADD CONSTRAINT "CreditReview_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CreditSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIntake" ADD CONSTRAINT "ReviewIntake_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewFinding" ADD CONSTRAINT "ReviewFinding_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "OptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAccountSnapshot" ADD CONSTRAINT "CreditAccountSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CreditSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
