-- CreateEnum
CREATE TYPE "PlanPurpose" AS ENUM ('PREPARATION', 'NURTURE', 'POST_ROUND', 'MAJOR_READINESS');

-- CreateEnum
CREATE TYPE "PlanLifecycleStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'STALE', 'SUPERSEDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanItemType" AS ENUM ('ACTION', 'GUIDANCE', 'MILESTONE');

-- CreateEnum
CREATE TYPE "PlanCompletionMode" AS ENUM ('ACKNOWLEDGEMENT', 'STRUCTURED_OUTCOME', 'CLIENT_REPORT_CONSULTANT_VERIFY', 'CONSULTANT_VERIFY', 'SYSTEM_VERIFY');

-- CreateEnum
CREATE TYPE "PlanItemExecutionStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'AWAITING_VERIFICATION', 'UNABLE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanDependencyMode" AS ENUM ('ALL', 'ANY');

-- CreateEnum
CREATE TYPE "PlanPathStatus" AS ENUM ('AVAILABLE', 'ACTIVE', 'INACTIVE', 'RETIRED');

-- AlterTable
ALTER TABLE "AnonymousGoalIntake" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClientGoalRevision" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClientUpdate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ServiceProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "purpose" "PlanPurpose" NOT NULL,
    "status" "PlanLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceReviewId" UUID,
    "sourceReviewVersion" INTEGER,
    "sourceGoalRevisionId" UUID,
    "sourceProfileVersion" INTEGER,
    "sourceFingerprint" TEXT NOT NULL,
    "supersedesVersionId" UUID,
    "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "staleAt" TIMESTAMP(3),
    "staleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "stableKey" TEXT NOT NULL,
    "type" "PlanItemType" NOT NULL,
    "completionMode" "PlanCompletionMode" NOT NULL,
    "status" "PlanItemExecutionStatus" NOT NULL DEFAULT 'LOCKED',
    "owner" "PlanActionOwner" NOT NULL,
    "clientTitle" TEXT NOT NULL,
    "clientBody" TEXT,
    "consultantRationale" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "targetAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "deepLink" TEXT,
    "outcomeSchema" JSONB,
    "manuallyProtected" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPath" (
    "id" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "clientLabel" TEXT NOT NULL,
    "internalLabel" TEXT,
    "status" "PlanPathStatus" NOT NULL DEFAULT 'AVAILABLE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPathItem" (
    "pathId" UUID NOT NULL,
    "itemId" UUID NOT NULL,

    CONSTRAINT "PlanPathItem_pkey" PRIMARY KEY ("pathId","itemId")
);

-- CreateTable
CREATE TABLE "PlanDependency" (
    "id" UUID NOT NULL,
    "dependentItemId" UUID NOT NULL,
    "prerequisiteItemId" UUID NOT NULL,
    "groupKey" TEXT NOT NULL DEFAULT 'default',
    "mode" "PlanDependencyMode" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "PlanDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItemOutcome" (
    "id" UUID NOT NULL,
    "planItemId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanItemOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_clientId_status_updatedAt_idx" ON "Plan"("clientId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "PlanVersion_planId_status_version_idx" ON "PlanVersion"("planId", "status", "version");

-- CreateIndex
CREATE INDEX "PlanVersion_sourceReviewId_sourceReviewVersion_idx" ON "PlanVersion"("sourceReviewId", "sourceReviewVersion");

-- CreateIndex
CREATE INDEX "PlanVersion_sourceGoalRevisionId_idx" ON "PlanVersion"("sourceGoalRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "PlanItem_planVersionId_status_sortOrder_id_idx" ON "PlanItem"("planVersionId", "status", "sortOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planVersionId_stableKey_key" ON "PlanItem"("planVersionId", "stableKey");

-- CreateIndex
CREATE INDEX "PlanPath_planVersionId_status_sortOrder_idx" ON "PlanPath"("planVersionId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPath_planVersionId_key_key" ON "PlanPath"("planVersionId", "key");

-- CreateIndex
CREATE INDEX "PlanPathItem_itemId_idx" ON "PlanPathItem"("itemId");

-- CreateIndex
CREATE INDEX "PlanDependency_prerequisiteItemId_idx" ON "PlanDependency"("prerequisiteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDependency_dependentItemId_prerequisiteItemId_key" ON "PlanDependency"("dependentItemId", "prerequisiteItemId");

-- CreateIndex
CREATE INDEX "PlanItemOutcome_planItemId_createdAt_idx" ON "PlanItemOutcome"("planItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItemOutcome_planItemId_idempotencyKey_key" ON "PlanItemOutcome"("planItemId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPath" ADD CONSTRAINT "PlanPath_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPathItem" ADD CONSTRAINT "PlanPathItem_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "PlanPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPathItem" ADD CONSTRAINT "PlanPathItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDependency" ADD CONSTRAINT "PlanDependency_dependentItemId_fkey" FOREIGN KEY ("dependentItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDependency" ADD CONSTRAINT "PlanDependency_prerequisiteItemId_fkey" FOREIGN KEY ("prerequisiteItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItemOutcome" ADD CONSTRAINT "PlanItemOutcome_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PaymentGatewayConfig_enabledForNewPayments_defaultForCheckout_i" RENAME TO "PaymentGatewayConfig_enabledForNewPayments_defaultForChecko_idx";
