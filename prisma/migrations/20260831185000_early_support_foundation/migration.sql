CREATE TYPE "SupportContextType" AS ENUM ('GENERAL', 'DOCUMENT', 'REVIEW', 'APPLICATION_SESSION');

CREATE TABLE "SupportCategoryDefinition" (
  "key" "SupportCategory" NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  "allowedContextTypes" "SupportContextType"[] NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SupportCategoryDefinition_pkey" PRIMARY KEY ("key")
);

INSERT INTO "SupportCategoryDefinition" ("key", "name", "allowedContextTypes", "updatedAt") VALUES
  ('ACCOUNT', 'Account', ARRAY['GENERAL']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('BILLING', 'Billing', ARRAY['GENERAL']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('CREDIT_REVIEW', 'Credit Review', ARRAY['GENERAL','DOCUMENT','REVIEW']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('DOCUMENTS', 'Documents', ARRAY['GENERAL','DOCUMENT']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('APPLICATION_ROUND', 'Application Round', ARRAY['GENERAL','APPLICATION_SESSION']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('MAJOR_READINESS', 'Credit Readiness', ARRAY['GENERAL','REVIEW']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('TECHNICAL', 'Technical', ARRAY['GENERAL']::"SupportContextType"[], CURRENT_TIMESTAMP),
  ('OTHER', 'Other', ARRAY['GENERAL']::"SupportContextType"[], CURRENT_TIMESTAMP);

ALTER TABLE "SupportCase"
  ADD COLUMN "contextType" "SupportContextType" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "contextResourceId" UUID,
  ADD COLUMN "clientReadAt" TIMESTAMP(3),
  ADD COLUMN "staffReadAt" TIMESTAMP(3);

ALTER TABLE "SupportMessage" ADD COLUMN "idempotencyKey" TEXT;

CREATE TABLE "SupportAttachment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supportCaseId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "attachedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportCategoryDefinition_enabled_clientVisible_idx" ON "SupportCategoryDefinition"("enabled", "clientVisible");
CREATE UNIQUE INDEX "SupportMessage_supportCaseId_authorUserId_idempotencyKey_key" ON "SupportMessage"("supportCaseId", "authorUserId", "idempotencyKey");
CREATE UNIQUE INDEX "SupportAttachment_supportCaseId_documentId_key" ON "SupportAttachment"("supportCaseId", "documentId");
CREATE INDEX "SupportAttachment_documentId_idx" ON "SupportAttachment"("documentId");

ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_category_fkey"
  FOREIGN KEY ("category") REFERENCES "SupportCategoryDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_supportCaseId_fkey"
  FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportAttachment" ADD CONSTRAINT "SupportAttachment_attachedByUserId_fkey"
  FOREIGN KEY ("attachedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
