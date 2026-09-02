CREATE TYPE "CreditReportValidationStatus" AS ENUM (
  'UPLOADED',
  'VALIDATED',
  'NEEDS_STAFF_REVIEW',
  'ACCEPTED',
  'REJECTED'
);

ALTER TABLE "CreditReportDocument"
  ADD COLUMN "validationStatus" "CreditReportValidationStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "sourceEntered" TEXT,
  ADD COLUMN "sourceDetected" TEXT,
  ADD COLUMN "reportDateEntered" DATE,
  ADD COLUMN "reportDateDetected" DATE,
  ADD COLUMN "rejectionCode" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "supersededById" UUID;

CREATE UNIQUE INDEX "CreditReportDocument_supersededById_key"
  ON "CreditReportDocument"("supersededById");

ALTER TABLE "CreditReportDocument"
  ADD CONSTRAINT "CreditReportDocument_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "CreditReportDocument"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
