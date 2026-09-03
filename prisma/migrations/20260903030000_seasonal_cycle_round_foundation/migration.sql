ALTER TYPE "ApplicationCycleStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

CREATE TYPE "CreditCardRoundStatus" AS ENUM ('PREPARATION', 'READY_FOR_STRATEGY', 'BLOCKED', 'COMPLETE', 'CANCELLED');
CREATE TYPE "RoundMajorApplicationChoice" AS ENUM ('NO', 'MORTGAGE', 'AUTO', 'STUDENT', 'OTHER_MAJOR_FINANCING', 'NOT_SURE');

ALTER TABLE "ApplicationCycle"
  ADD COLUMN "pausedAt" TIMESTAMPTZ(3),
  ADD COLUMN "resumedAt" TIMESTAMPTZ(3),
  ADD COLUMN "goalConfirmedAt" TIMESTAMPTZ(3);

CREATE TABLE "CreditCardRound" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "goalSnapshotId" UUID NOT NULL,
  "profileStateId" UUID NOT NULL,
  "sourceReviewId" UUID,
  "preparationPlanVersionId" UUID,
  "serviceEntitlementId" UUID NOT NULL,
  "status" "CreditCardRoundStatus" NOT NULL DEFAULT 'PREPARATION',
  "sourceFingerprint" TEXT NOT NULL,
  "sourceContext" JSONB NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blockedAt" TIMESTAMPTZ(3),
  "blockedReason" TEXT,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CreditCardRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoundMajorApplicationCheck" (
  "id" UUID NOT NULL,
  "roundId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "choice" "RoundMajorApplicationChoice" NOT NULL,
  "intendedTiming" VARCHAR(160),
  "clientContext" VARCHAR(1000),
  "sourceMajorContextId" UUID,
  "submittedByUserId" UUID NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoundMajorApplicationCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditCardRound_serviceEntitlementId_key" ON "CreditCardRound"("serviceEntitlementId");
CREATE UNIQUE INDEX "CreditCardRound_cycleId_clientId_key" ON "CreditCardRound"("cycleId", "clientId");
CREATE INDEX "CreditCardRound_clientId_status_startedAt_idx" ON "CreditCardRound"("clientId", "status", "startedAt");
CREATE INDEX "CreditCardRound_cycleId_status_idx" ON "CreditCardRound"("cycleId", "status");
CREATE INDEX "CreditCardRound_sourceReviewId_idx" ON "CreditCardRound"("sourceReviewId");
CREATE UNIQUE INDEX "RoundMajorApplicationCheck_roundId_version_key" ON "RoundMajorApplicationCheck"("roundId", "version");
CREATE INDEX "RoundMajorApplicationCheck_roundId_submittedAt_idx" ON "RoundMajorApplicationCheck"("roundId", "submittedAt");
CREATE INDEX "RoundMajorApplicationCheck_clientId_submittedAt_idx" ON "RoundMajorApplicationCheck"("clientId", "submittedAt");

ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_goalSnapshotId_fkey" FOREIGN KEY ("goalSnapshotId") REFERENCES "CycleGoalSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_profileStateId_fkey" FOREIGN KEY ("profileStateId") REFERENCES "CreditProfileState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_sourceReviewId_fkey" FOREIGN KEY ("sourceReviewId") REFERENCES "CreditReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_preparationPlanVersionId_fkey" FOREIGN KEY ("preparationPlanVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditCardRound" ADD CONSTRAINT "CreditCardRound_serviceEntitlementId_fkey" FOREIGN KEY ("serviceEntitlementId") REFERENCES "ServiceEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoundMajorApplicationCheck" ADD CONSTRAINT "RoundMajorApplicationCheck_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CreditCardRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoundMajorApplicationCheck" ADD CONSTRAINT "RoundMajorApplicationCheck_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
