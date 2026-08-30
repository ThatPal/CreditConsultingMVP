CREATE TYPE "ApplicationCycleStatus" AS ENUM ('ACTIVE', 'COMPLETE', 'CANCELLED');
CREATE TYPE "ApplicationCycleReadiness" AS ENUM ('READY', 'ACTION_REQUIRED', 'NOT_READY');
CREATE TYPE "ApplicationCycleStage" AS ENUM ('STARTED', 'REVIEW_PURCHASE', 'CREDIT_REVIEW', 'CONSULTANT_DECISION', 'POST_REVIEW_ACTIONS', 'ROUND_PURCHASE', 'STRATEGY', 'APPLICATION_SEQUENCE', 'APPLICATION_ROUND', 'RESULTS', 'POST_APPLICATION_ACTIONS', 'FINAL_RESULTS');
CREATE TYPE "ApplicationCycleStepStatus" AS ENUM ('NOT_STARTED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETE', 'SKIPPED', 'BLOCKED');

CREATE TABLE "ApplicationCycle" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "cycleNumber" INTEGER NOT NULL,
  "status" "ApplicationCycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStage" "ApplicationCycleStage" NOT NULL DEFAULT 'STARTED',
  "readinessDecision" "ApplicationCycleReadiness",
  "madeItToApplications" BOOLEAN NOT NULL DEFAULT false,
  "finalResult" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationCycleStep" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "stage" "ApplicationCycleStage" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "ApplicationCycleStepStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "sortOrder" INTEGER NOT NULL,
  "sourceType" TEXT,
  "sourceId" UUID,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApplicationCycleStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CycleApplication" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "cardName" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "scope" "ClientCardScope" NOT NULL,
  "outcome" "CardApplicationOutcome" NOT NULL,
  "approvedLimit" DECIMAL(14,2),
  "submittedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CycleApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationCycle_clientId_cycleNumber_key" ON "ApplicationCycle"("clientId", "cycleNumber");
CREATE INDEX "ApplicationCycle_clientId_status_startedAt_idx" ON "ApplicationCycle"("clientId", "status", "startedAt");
CREATE UNIQUE INDEX "ApplicationCycleStep_cycleId_stage_key" ON "ApplicationCycleStep"("cycleId", "stage");
CREATE INDEX "ApplicationCycleStep_cycleId_sortOrder_idx" ON "ApplicationCycleStep"("cycleId", "sortOrder");
CREATE INDEX "CycleApplication_cycleId_submittedAt_idx" ON "CycleApplication"("cycleId", "submittedAt");
ALTER TABLE "ApplicationCycle" ADD CONSTRAINT "ApplicationCycle_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationCycleStep" ADD CONSTRAINT "ApplicationCycleStep_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CycleApplication" ADD CONSTRAINT "CycleApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
