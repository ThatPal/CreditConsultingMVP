ALTER TABLE "CreditCardRound"
  ADD COLUMN "finalAnalysisId" UUID,
  ADD COLUMN "finalizedByUserId" UUID,
  ADD COLUMN "finalizationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextReviewAt" TIMESTAMPTZ(3);
CREATE INDEX "CreditCardRound_finalAnalysisId_idx" ON "CreditCardRound"("finalAnalysisId");
