CREATE TYPE "PreLiveConfirmationDisposition" AS ENUM ('CURRENT', 'MATERIAL_CHANGE_REVIEW_REQUIRED', 'SUPERSEDED');
CREATE TABLE "PreLiveMaterialChangeConfirmation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" UUID NOT NULL, "clientId" UUID NOT NULL, "roundId" UUID NOT NULL,
  "strategyVersionId" UUID NOT NULL, "version" INTEGER NOT NULL, "sourceFingerprint" TEXT NOT NULL, "confirmationVersion" INTEGER NOT NULL DEFAULT 1,
  "submittedByUserId" UUID NOT NULL, "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "noChanges" BOOLEAN NOT NULL,
  "reportedDeltas" JSONB NOT NULL, "note" VARCHAR(1000), "disposition" "PreLiveConfirmationDisposition" NOT NULL,
  "supersededAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreLiveMaterialChangeConfirmation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PreLiveMaterialChangeConfirmation_sessionId_version_key" ON "PreLiveMaterialChangeConfirmation"("sessionId", "version");
CREATE INDEX "PreLiveMaterialChangeConfirmation_sessionId_disposition_submittedAt_idx" ON "PreLiveMaterialChangeConfirmation"("sessionId", "disposition", "submittedAt");
CREATE INDEX "PreLiveMaterialChangeConfirmation_clientId_submittedAt_idx" ON "PreLiveMaterialChangeConfirmation"("clientId", "submittedAt");
ALTER TABLE "PreLiveMaterialChangeConfirmation" ADD CONSTRAINT "PreLiveMaterialChangeConfirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApplicationSession"("id") ON DELETE RESTRICT;
ALTER TABLE "PreLiveMaterialChangeConfirmation" ADD CONSTRAINT "PreLiveMaterialChangeConfirmation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CreditCardRound"("id") ON DELETE RESTRICT;
ALTER TABLE "PreLiveMaterialChangeConfirmation" ADD CONSTRAINT "PreLiveMaterialChangeConfirmation_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT;
