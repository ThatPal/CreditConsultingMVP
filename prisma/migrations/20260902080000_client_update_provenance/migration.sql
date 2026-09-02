CREATE TYPE "ClientUpdateCategory" AS ENUM (
  'NEW_ACCOUNT', 'BALANCE_CHANGED', 'LIMIT_CHANGED', 'ACCOUNT_CLOSED', 'NOT_MINE',
  'AUTHORIZED_USER_CHANGED', 'PROMOTIONAL_OFFER_CHANGED', 'RECENT_APPLICATION',
  'FINANCIAL_RELATIONSHIP', 'OTHER'
);

CREATE TYPE "ClientUpdateSource" AS ENUM ('CLIENT_DECLARED', 'PLATFORM_OBSERVED');

ALTER TABLE "ReviewIntake" ADD COLUMN "noChangesConfirmedAt" TIMESTAMPTZ(3);

CREATE TABLE "ClientUpdate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL,
  "reviewId" UUID,
  "sourceKey" TEXT NOT NULL,
  "category" "ClientUpdateCategory" NOT NULL,
  "source" "ClientUpdateSource" NOT NULL,
  "subject" TEXT,
  "details" TEXT,
  "effectiveDate" DATE,
  "provenance" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMPTZ(3),
  CONSTRAINT "ClientUpdate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientUpdate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClientUpdate_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClientUpdate_reviewId_sourceKey_key" ON "ClientUpdate"("reviewId", "sourceKey");
CREATE INDEX "ClientUpdate_clientId_supersededAt_effectiveDate_idx" ON "ClientUpdate"("clientId", "supersededAt", "effectiveDate");
CREATE INDEX "ClientUpdate_reviewId_supersededAt_idx" ON "ClientUpdate"("reviewId", "supersededAt");
