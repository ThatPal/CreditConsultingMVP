CREATE TABLE "WorkflowRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "trigger" TEXT NOT NULL,
  "conditionType" TEXT NOT NULL,
  "conditionConfig" JSONB NOT NULL,
  "actionType" TEXT NOT NULL,
  "actionConfig" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retiredAt" TIMESTAMPTZ(3),
  CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowRule_key_version_key" ON "WorkflowRule"("key", "version");
CREATE INDEX "WorkflowRule_trigger_enabled_idx" ON "WorkflowRule"("trigger", "enabled");
