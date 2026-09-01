ALTER TABLE "WorkItem"
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sourceId" UUID,
  ADD COLUMN "reasonCode" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "deepLink" JSONB,
  ADD COLUMN "neededSince" TIMESTAMP(3),
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "WorkItem_sourceType_sourceId_idx" ON "WorkItem"("sourceType", "sourceId");
CREATE INDEX "WorkItem_status_priority_neededSince_id_idx" ON "WorkItem"("status", "priority", "neededSince", "id");
CREATE INDEX "WorkItem_dedupeKey_status_idx" ON "WorkItem"("dedupeKey", "status");

CREATE UNIQUE INDEX "WorkItem_one_active_condition_key"
  ON "WorkItem"("dedupeKey")
  WHERE "dedupeKey" IS NOT NULL AND "status" IN ('OPEN', 'IN_PROGRESS', 'WAITING');
