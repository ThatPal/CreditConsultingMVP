ALTER TABLE "StrategyVersion"
  ADD CONSTRAINT "StrategyVersion_aiJobId_fkey"
  FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StrategyVersion"
  ADD CONSTRAINT "StrategyVersion_aiJobOutputId_fkey"
  FOREIGN KEY ("aiJobOutputId") REFERENCES "AIJobOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StrategyApplication"
  ADD CONSTRAINT "StrategyApplication_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "StrategyCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "StrategyApplication_candidateId_idx" ON "StrategyApplication"("candidateId");
