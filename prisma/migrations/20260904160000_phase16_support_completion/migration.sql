ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'PLAN';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'APPLICATION_ROUND';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'STRATEGY';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'APPOINTMENT';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'POST_ROUND';
ALTER TYPE "SupportContextType" ADD VALUE IF NOT EXISTS 'MAJOR_READINESS';

ALTER TABLE "SupportCase"
  ADD COLUMN "assignmentVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "routedQueue" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "slaDueAt" TIMESTAMPTZ(3),
  ADD COLUMN "escalatedAt" TIMESTAMPTZ(3),
  ADD COLUMN "reopenedAt" TIMESTAMPTZ(3);

CREATE TABLE "SupportAssignmentEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supportCaseId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "fromAssigneeId" UUID,
  "toAssigneeId" UUID,
  "eventType" TEXT NOT NULL,
  "reason" TEXT,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAssignmentEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportAssignmentEvent_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SupportAssignmentEvent_supportCaseId_version_key" ON "SupportAssignmentEvent"("supportCaseId", "version");
CREATE INDEX "SupportAssignmentEvent_supportCaseId_createdAt_id_idx" ON "SupportAssignmentEvent"("supportCaseId", "createdAt", "id");
CREATE INDEX "SupportCase_routedQueue_status_priority_slaDueAt_id_idx" ON "SupportCase"("routedQueue", "status", "priority", "slaDueAt", "id");

CREATE TABLE "SupportAIArtifact" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supportCaseId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROPOSED',
  "aiJobId" UUID,
  "aiJobOutputId" UUID,
  "model" TEXT,
  "provider" TEXT,
  "promptVersion" TEXT NOT NULL,
  "sourceMessageCount" INTEGER NOT NULL,
  "structuredOutput" JSONB NOT NULL,
  "editedAt" TIMESTAMPTZ(3),
  "acceptedAt" TIMESTAMPTZ(3),
  "sentMessageId" UUID,
  "supersededAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAIArtifact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportAIArtifact_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SupportAIArtifact_supportCaseId_kind_createdAt_id_idx" ON "SupportAIArtifact"("supportCaseId", "kind", "createdAt", "id");
CREATE INDEX "SupportAIArtifact_aiJobId_idx" ON "SupportAIArtifact"("aiJobId");
