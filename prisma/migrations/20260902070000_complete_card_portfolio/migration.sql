CREATE TYPE "ClientCardPortfolioType" AS ENUM (
  'PERSONAL_CREDIT',
  'BUSINESS_CREDIT',
  'SECURED',
  'NON_REPORTING'
);

CREATE TYPE "ClientCardIdentityStatus" AS ENUM ('CONFIRMED', 'UNRESOLVED');

ALTER TABLE "ClientCard"
  ADD COLUMN "portfolioType" "ClientCardPortfolioType" NOT NULL DEFAULT 'PERSONAL_CREDIT',
  ADD COLUMN "identityStatus" "ClientCardIdentityStatus" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "maskedIdentifier" TEXT,
  ADD COLUMN "reportsToBureaus" BOOLEAN;

UPDATE "ClientCard"
SET "portfolioType" = CASE
  WHEN "scope" = 'BUSINESS' THEN 'BUSINESS_CREDIT'::"ClientCardPortfolioType"
  ELSE 'PERSONAL_CREDIT'::"ClientCardPortfolioType"
END;

CREATE INDEX "ClientCard_clientId_portfolioType_identityStatus_idx"
  ON "ClientCard"("clientId", "portfolioType", "identityStatus");
