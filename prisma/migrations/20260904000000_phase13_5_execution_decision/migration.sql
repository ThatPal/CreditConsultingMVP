CREATE TYPE "LiveExecutionDecisionType" AS ENUM ('READY_TO_RELEASE_ALLOWED_CARD', 'STOP_APPLICATION_SEQUENCE', 'PAUSE_FOR_CONSULTANT', 'WAIT_FOR_CLIENT_RESULT', 'END_SESSION_READY', 'INTERVENTION_REQUIRED');
CREATE TABLE "LiveExecutionDecision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" UUID NOT NULL, "sourceApplicationId" UUID, "sourceEventId" UUID,
  "strategyApplicationId" UUID, "decisionType" "LiveExecutionDecisionType" NOT NULL, "reasonCode" TEXT NOT NULL,
  "policySnapshot" JSONB NOT NULL, "current" BOOLEAN NOT NULL DEFAULT true, "decidedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "supersededAt" TIMESTAMPTZ(3),
  CONSTRAINT "LiveExecutionDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveExecutionDecision_sessionId_current_createdAt_id_idx" ON "LiveExecutionDecision"("sessionId", "current", "createdAt", "id");
CREATE INDEX "LiveExecutionDecision_sourceEventId_idx" ON "LiveExecutionDecision"("sourceEventId");
CREATE UNIQUE INDEX "LiveExecutionDecision_one_current_per_session" ON "LiveExecutionDecision"("sessionId") WHERE "current" = true;
CREATE UNIQUE INDEX "LiveExecutionDecision_sourceEventId_key" ON "LiveExecutionDecision"("sourceEventId") WHERE "sourceEventId" IS NOT NULL;
ALTER TABLE "LiveExecutionDecision" ADD CONSTRAINT "LiveExecutionDecision_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApplicationSession"("id") ON DELETE RESTRICT;
