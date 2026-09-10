ALTER TABLE "PlanItemOutcome" ADD COLUMN "responseSnapshot" JSONB;
CREATE TABLE "PlanOutcomeAttachment" (
  "id" UUID NOT NULL,
  "outcomeId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  CONSTRAINT "PlanOutcomeAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanOutcomeAttachment_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PlanItemOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanOutcomeAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanOutcomeAttachment_outcomeId_documentId_key" ON "PlanOutcomeAttachment"("outcomeId", "documentId");
CREATE INDEX "PlanOutcomeAttachment_documentId_idx" ON "PlanOutcomeAttachment"("documentId");
