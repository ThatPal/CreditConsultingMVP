DO $$
BEGIN
IF to_regclass('"RoundStrategy"') IS NULL THEN
CREATE TYPE "RoundStrategyStatus" AS ENUM ('DRAFT', 'READY_FOR_APPROVAL', 'APPROVED', 'STALE');
CREATE TYPE "StrategyVersionStatus" AS ENUM ('DRAFT', 'READY_FOR_APPROVAL', 'APPROVED', 'SUPERSEDED', 'STALE');
CREATE TYPE "StrategyCandidateDisposition" AS ENUM ('SHORTLISTED', 'EXCLUDED');
CREATE TYPE "StrategyApplicationRole" AS ENUM ('PLANNED', 'ALTERNATIVE', 'CONDITIONAL');

CREATE TABLE "RoundStrategy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "roundId" UUID NOT NULL, "clientId" UUID NOT NULL,
  "status" "RoundStrategyStatus" NOT NULL DEFAULT 'DRAFT', "version" INTEGER NOT NULL DEFAULT 1,
  "approvedVersionId" UUID, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "RoundStrategy_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StrategyVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "strategyId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "status" "StrategyVersionStatus" NOT NULL DEFAULT 'DRAFT', "sourceFingerprint" TEXT NOT NULL,
  "sourceContext" JSONB NOT NULL, "aiJobId" UUID, "aiJobOutputId" UUID, "aiProposal" JSONB,
  "brief" JSONB NOT NULL, "rules" JSONB NOT NULL, "validation" JSONB, "createdByUserId" UUID NOT NULL,
  "approvedByUserId" UUID, "approvalNote" VARCHAR(1000), "approvedAt" TIMESTAMPTZ(3),
  "staleAt" TIMESTAMPTZ(3), "supersededAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "StrategyVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StrategyCandidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "strategyVersionId" UUID NOT NULL, "productId" UUID NOT NULL,
  "offerVersionId" UUID NOT NULL, "insightVersionId" UUID, "disposition" "StrategyCandidateDisposition" NOT NULL,
  "role" "StrategyApplicationRole", "internalRationale" VARCHAR(2000), "clientSafeReason" VARCHAR(1000),
  "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "StrategyCandidate_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StrategyApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "strategyVersionId" UUID NOT NULL, "candidateId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL, "role" "StrategyApplicationRole" NOT NULL, "timingRule" JSONB NOT NULL,
  "dependencyRule" JSONB NOT NULL, "stopRule" JSONB NOT NULL, "reconsiderationRule" JSONB NOT NULL,
  "internalRationale" VARCHAR(2000) NOT NULL, "clientSafeReason" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StrategyApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoundStrategy_roundId_key" ON "RoundStrategy"("roundId");
CREATE UNIQUE INDEX "RoundStrategy_approvedVersionId_key" ON "RoundStrategy"("approvedVersionId");
CREATE INDEX "RoundStrategy_clientId_status_updatedAt_idx" ON "RoundStrategy"("clientId", "status", "updatedAt");
CREATE UNIQUE INDEX "StrategyVersion_strategyId_version_key" ON "StrategyVersion"("strategyId", "version");
CREATE INDEX "StrategyVersion_strategyId_status_createdAt_idx" ON "StrategyVersion"("strategyId", "status", "createdAt");
CREATE INDEX "StrategyVersion_aiJobId_aiJobOutputId_idx" ON "StrategyVersion"("aiJobId", "aiJobOutputId");
CREATE UNIQUE INDEX "StrategyCandidate_strategyVersionId_productId_key" ON "StrategyCandidate"("strategyVersionId", "productId");
CREATE INDEX "StrategyCandidate_strategyVersionId_disposition_sortOrder_id_idx" ON "StrategyCandidate"("strategyVersionId", "disposition", "sortOrder", "id");
CREATE UNIQUE INDEX "StrategyApplication_strategyVersionId_sequence_key" ON "StrategyApplication"("strategyVersionId", "sequence");
CREATE UNIQUE INDEX "StrategyApplication_strategyVersionId_candidateId_key" ON "StrategyApplication"("strategyVersionId", "candidateId");
ALTER TABLE "RoundStrategy" ADD CONSTRAINT "RoundStrategy_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CreditCardRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategyVersion" ADD CONSTRAINT "StrategyVersion_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "RoundStrategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StrategyCandidate" ADD CONSTRAINT "StrategyCandidate_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategyApplication" ADD CONSTRAINT "StrategyApplication_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoundStrategy" ADD CONSTRAINT "RoundStrategy_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF;
END $$;
