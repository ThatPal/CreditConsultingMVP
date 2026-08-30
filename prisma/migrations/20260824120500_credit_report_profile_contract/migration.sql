ALTER TABLE "CreditSnapshot"
  ADD COLUMN "scoreModel" TEXT,
  ADD COLUMN "oldestAccountAgeMonths" INTEGER,
  ADD COLUMN "revolvingAccounts" INTEGER,
  ADD COLUMN "installmentAccounts" INTEGER,
  ADD COLUMN "closedAccounts" INTEGER,
  ADD COLUMN "latePayments" INTEGER,
  ADD COLUMN "collections" INTEGER,
  ADD COLUMN "chargeOffs" INTEGER,
  ADD COLUMN "bankruptcies" INTEGER,
  ADD COLUMN "paymentHistoryStatus" TEXT;

CREATE TABLE "CreditReportDocument" (
  "id" UUID NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "provider" TEXT,
  "reportDate" TIMESTAMP(3),
  "bureauCoverage" JSONB,
  "uploadedByUserId" UUID NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "CreditReportDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditReportDocument_storageKey_key" ON "CreditReportDocument"("storageKey");
CREATE INDEX "CreditReportDocument_uploadedByUserId_uploadedAt_idx" ON "CreditReportDocument"("uploadedByUserId", "uploadedAt");

ALTER TABLE "ReviewIntake" ADD COLUMN "reportDocumentId" UUID;
CREATE UNIQUE INDEX "ReviewIntake_reportDocumentId_key" ON "ReviewIntake"("reportDocumentId");
ALTER TABLE "ReviewIntake" ADD CONSTRAINT "ReviewIntake_reportDocumentId_fkey"
  FOREIGN KEY ("reportDocumentId") REFERENCES "CreditReportDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CreditAccountSnapshot"
  ADD COLUMN "maskedAccountNumber" TEXT,
  ADD COLUMN "responsibility" TEXT,
  ADD COLUMN "scope" "GoalScope",
  ADD COLUMN "lastReportedAt" TIMESTAMP(3),
  ADD COLUMN "promotionalAprExpiresAt" TIMESTAMP(3),
  ADD COLUMN "attentionStatus" TEXT;
