ALTER TABLE "ReviewDraft"
  ADD COLUMN "analysis" JSONB,
  ADD COLUMN "recommendation" JSONB,
  ADD COLUMN "analysisApprovedAt" TIMESTAMPTZ(3),
  ADD COLUMN "recommendationApprovedAt" TIMESTAMPTZ(3),
  ADD COLUMN "approvedByUserId" UUID;

CREATE TABLE "ReviewDraftFinding" (
  "id" UUID NOT NULL,
  "draftId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "clientSummary" TEXT,
  "internalDetail" TEXT,
  "severity" "FindingSeverity" NOT NULL,
  "status" "ReviewFindingStatus" NOT NULL DEFAULT 'PROPOSED',
  "origin" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "aiProvenance" JSONB,
  "actorId" UUID,
  "decisionReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ReviewDraftFinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewDraftFinding_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ReviewDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReviewDraftFinding_draftId_code_key" ON "ReviewDraftFinding"("draftId", "code");
CREATE INDEX "ReviewDraftFinding_draftId_status_severity_idx" ON "ReviewDraftFinding"("draftId", "status", "severity");
