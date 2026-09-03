CREATE TYPE "PostRoundFollowUpKind" AS ENUM ('PENDING_APPLICATION', 'RECONSIDERATION', 'CREDIT_LIMIT_INCREASE', 'ADDITIONAL_CARD');
CREATE TYPE "PostRoundFollowUpStatus" AS ENUM ('OPEN', 'COMPLETE', 'UNABLE_TO_COMPLETE', 'WAIVED');

CREATE TABLE "PostRoundFollowUp" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "roundId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "applicationId" UUID,
  "clientCardId" UUID,
  "planItemId" UUID,
  "kind" "PostRoundFollowUpKind" NOT NULL,
  "status" "PostRoundFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "required" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "currentResult" JSONB,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PostRoundFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostRoundFollowUp_roundId_kind_applicationId_clientCardId_key" ON "PostRoundFollowUp"("roundId", "kind", "applicationId", "clientCardId");
CREATE INDEX "PostRoundFollowUp_roundId_status_createdAt_id_idx" ON "PostRoundFollowUp"("roundId", "status", "createdAt", "id");
CREATE INDEX "PostRoundFollowUp_clientId_status_idx" ON "PostRoundFollowUp"("clientId", "status");
