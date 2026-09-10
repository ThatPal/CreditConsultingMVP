ALTER TABLE "PlanVersion" ADD COLUMN "title" TEXT;
ALTER TABLE "PlanVersion" ADD COLUMN "purpose" "PlanPurpose";

UPDATE "PlanVersion" AS version
SET "title" = plan."title", "purpose" = plan."purpose"
FROM "Plan" AS plan
WHERE version."planId" = plan."id";
