CREATE TYPE "ClientCardScope" AS ENUM ('PERSONAL', 'BUSINESS');
CREATE TYPE "ClientCardAccountStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CardApplicationOutcome" AS ENUM ('APPROVED', 'DECLINED', 'PENDING');
CREATE TYPE "CardApplicationSource" AS ENUM ('CLIENT', 'CONSULTANT');

CREATE TABLE "ClientCard" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "cardName" TEXT NOT NULL,
  "issuer" TEXT NOT NULL,
  "scope" "ClientCardScope" NOT NULL,
  "creditLimit" DECIMAL(14,2),
  "balance" DECIMAL(14,2),
  "accountStatus" "ClientCardAccountStatus",
  "applicationOutcome" "CardApplicationOutcome",
  "applicationSource" "CardApplicationSource",
  "appliedAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientCard_clientId_accountStatus_issuer_idx"
  ON "ClientCard"("clientId", "accountStatus", "issuer");
CREATE INDEX "ClientCard_clientId_applicationOutcome_appliedAt_idx"
  ON "ClientCard"("clientId", "applicationOutcome", "appliedAt");
ALTER TABLE "ClientCard" ADD CONSTRAINT "ClientCard_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
