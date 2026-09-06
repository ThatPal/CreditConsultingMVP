ALTER TYPE "OutboxEventStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "OutboxEvent"
  ADD COLUMN "claimToken" UUID,
  ADD COLUMN "claimExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "OutboxEvent_status_claimExpiresAt_createdAt_idx"
  ON "OutboxEvent"("status", "claimExpiresAt", "createdAt");
