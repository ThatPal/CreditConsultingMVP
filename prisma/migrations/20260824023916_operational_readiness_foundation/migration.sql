-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PlanActionStatus" AS ENUM ('READY', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanActionOwner" AS ENUM ('CLIENT', 'CONSULTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReadinessOutcome" AS ENUM ('APPLY_NOW', 'PREPARE_FIRST', 'WAIT');

-- CreateEnum
CREATE TYPE "ReadinessStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'CONFIRMED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "OptionKind" AS ENUM ('FINDING', 'RECOMMENDATION', 'RATIONALE', 'ACTION_BUNDLE', 'CHECKLIST', 'SUPPORT_MACRO');

-- CreateTable
CREATE TABLE "CreditSnapshot" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "aggregateUtilization" DECIMAL(5,2),
    "revolvingBalance" DECIMAL(14,2),
    "revolvingLimit" DECIMAL(14,2),
    "openAccounts" INTEGER,
    "recentInquiries" INTEGER,
    "derogatoryItems" INTEGER,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAction" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlanActionStatus" NOT NULL DEFAULT 'READY',
    "owner" "PlanActionOwner" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" UUID,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessAssessment" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "consultantId" UUID,
    "version" INTEGER NOT NULL,
    "status" "ReadinessStatus" NOT NULL DEFAULT 'DRAFT',
    "outcome" "ReadinessOutcome",
    "riskLevel" "RiskLevel",
    "scope" "GoalScope" NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "intendedAt" TIMESTAMP(3),
    "profileAsOf" TIMESTAMP(3),
    "timingBandDays" INTEGER,
    "overrideReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadinessAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessFactor" (
    "id" UUID NOT NULL,
    "assessmentId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "severity" "RiskLevel",
    "optionId" UUID,
    "value" TEXT,

    CONSTRAINT "ReadinessFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "assigneeId" UUID,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'NORMAL',
    "suggestedNextAction" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionTemplate" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "OptionKind" NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "OptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "clientId" UUID,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditSnapshot_clientId_capturedAt_idx" ON "CreditSnapshot"("clientId", "capturedAt");

-- CreateIndex
CREATE INDEX "PlanAction_clientId_status_sortOrder_idx" ON "PlanAction"("clientId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAction_sourceType_sourceId_title_key" ON "PlanAction"("sourceType", "sourceId", "title");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_clientId_status_idx" ON "ReadinessAssessment"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_clientId_version_key" ON "ReadinessAssessment"("clientId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessFactor_assessmentId_code_key" ON "ReadinessFactor"("assessmentId", "code");

-- CreateIndex
CREATE INDEX "WorkItem_assigneeId_status_priority_dueAt_idx" ON "WorkItem"("assigneeId", "status", "priority", "dueAt");

-- CreateIndex
CREATE INDEX "WorkItem_clientId_status_idx" ON "WorkItem"("clientId", "status");

-- CreateIndex
CREATE INDEX "OptionTemplate_kind_active_idx" ON "OptionTemplate"("kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "OptionTemplate_code_version_key" ON "OptionTemplate"("code", "version");

-- CreateIndex
CREATE INDEX "AuditEvent_clientId_createdAt_idx" ON "AuditEvent"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CreditSnapshot" ADD CONSTRAINT "CreditSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAction" ADD CONSTRAINT "PlanAction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessAssessment" ADD CONSTRAINT "ReadinessAssessment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessAssessment" ADD CONSTRAINT "ReadinessAssessment_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessFactor" ADD CONSTRAINT "ReadinessFactor_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessFactor" ADD CONSTRAINT "ReadinessFactor_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "OptionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
