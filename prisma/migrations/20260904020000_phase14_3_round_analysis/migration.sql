CREATE TYPE "RoundAnalysisKind" AS ENUM ('INITIAL', 'UPDATED', 'FINAL');
CREATE TYPE "RoundAnalysisStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');
CREATE TABLE "RoundAnalysis" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "roundId" UUID NOT NULL, "clientId" UUID NOT NULL,
  "version" INTEGER NOT NULL, "kind" "RoundAnalysisKind" NOT NULL, "status" "RoundAnalysisStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceFingerprint" TEXT NOT NULL, "sourceSnapshot" JSONB NOT NULL, "deterministicFacts" JSONB NOT NULL,
  "clientSafeContent" JSONB NOT NULL, "internalContent" JSONB, "preparedBy" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
  "approvedByUserId" UUID, "approvedAt" TIMESTAMPTZ(3), "supersededAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "RoundAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoundAnalysis_roundId_version_key" ON "RoundAnalysis"("roundId", "version");
CREATE INDEX "RoundAnalysis_roundId_status_version_idx" ON "RoundAnalysis"("roundId", "status", "version");
CREATE INDEX "RoundAnalysis_clientId_status_updatedAt_idx" ON "RoundAnalysis"("clientId", "status", "updatedAt");
