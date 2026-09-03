CREATE TYPE "CreditApplicationStatus" AS ENUM ('RELEASED', 'OPENED', 'RESULT_RECORDED', 'SKIPPED');
CREATE TYPE "CreditApplicationOutcome" AS ENUM ('APPROVED', 'DECLINED', 'PENDING', 'APPLICATION_NOT_COMPLETED', 'TECHNICAL_ISSUE', 'OTHER');
CREATE TABLE "CreditApplication" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" UUID NOT NULL, "clientId" UUID NOT NULL, "roundId" UUID NOT NULL,
  "strategyVersionId" UUID NOT NULL, "strategyApplicationId" UUID NOT NULL, "productId" UUID NOT NULL, "offerVersionId" UUID NOT NULL,
  "status" "CreditApplicationStatus" NOT NULL DEFAULT 'RELEASED', "outcome" "CreditApplicationOutcome", "approvedLimit" DECIMAL(12,2),
  "approvedLimitKnown" BOOLEAN, "issuerReason" VARCHAR(500), "releasedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedAt" TIMESTAMPTZ(3), "resultRecordedAt" TIMESTAMPTZ(3), "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditApplication_sessionId_strategyApplicationId_key" ON "CreditApplication"("sessionId", "strategyApplicationId");
CREATE INDEX "CreditApplication_sessionId_status_releasedAt_id_idx" ON "CreditApplication"("sessionId", "status", "releasedAt", "id");
CREATE INDEX "CreditApplication_roundId_outcome_idx" ON "CreditApplication"("roundId", "outcome");
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApplicationSession"("id") ON DELETE RESTRICT;
ALTER TABLE "CreditApplication" ADD CONSTRAINT "CreditApplication_strategyApplicationId_fkey" FOREIGN KEY ("strategyApplicationId") REFERENCES "StrategyApplication"("id") ON DELETE RESTRICT;

CREATE TABLE "CreditApplicationEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "applicationId" UUID NOT NULL, "sessionId" UUID NOT NULL, "actorUserId" UUID NOT NULL,
  "eventType" TEXT NOT NULL, "outcome" "CreditApplicationOutcome", "payload" JSONB NOT NULL, "correctionOfId" UUID,
  "reason" VARCHAR(500), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditApplicationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreditApplicationEvent_applicationId_createdAt_id_idx" ON "CreditApplicationEvent"("applicationId", "createdAt", "id");
CREATE INDEX "CreditApplicationEvent_sessionId_createdAt_id_idx" ON "CreditApplicationEvent"("sessionId", "createdAt", "id");
ALTER TABLE "CreditApplicationEvent" ADD CONSTRAINT "CreditApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CreditApplication"("id") ON DELETE RESTRICT;
