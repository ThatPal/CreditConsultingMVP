-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authFirstName" TEXT,
ADD COLUMN     "authLastName" TEXT,
ADD COLUMN     "authPhone" TEXT,
ADD COLUMN     "authTermsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "authTimezone" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- Preserve existing identities and credential usability. The application configures
-- Better Auth to verify the existing Argon2 hashes, so no plaintext or forced reset
-- is required. Existing users predate mandatory verification and are grandfathered.
UPDATE "User" AS u
SET "name" = COALESCE(NULLIF(BTRIM(CONCAT(c."firstName", ' ', c."lastName")), ''), u."email"),
    "emailVerified" = true,
    "authProvider" = 'better-auth'
FROM "Client" AS c
WHERE c."userId" = u."id";

UPDATE "User"
SET "name" = "email",
    "emailVerified" = true,
    "authProvider" = 'better-auth'
WHERE "name" = '';

-- CreateTable
CREATE TABLE "BetterAuthSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" UUID NOT NULL,

    CONSTRAINT "BetterAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetterAuthAccount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BetterAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetterAuthVerification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BetterAuthVerification_pkey" PRIMARY KEY ("id")
);

-- Cutover intentionally invalidates transitional sessions and reset links so only
-- Better Auth cookies and verification records remain authoritative.
UPDATE "AuthSession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;
UPDATE "PasswordResetToken" SET "usedAt" = CURRENT_TIMESTAMP WHERE "usedAt" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BetterAuthSession_token_key" ON "BetterAuthSession"("token");

-- CreateIndex
CREATE INDEX "BetterAuthSession_userId_expiresAt_idx" ON "BetterAuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "BetterAuthAccount_userId_idx" ON "BetterAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BetterAuthAccount_issuer_accountId_key" ON "BetterAuthAccount"("issuer", "accountId");

-- Credential accounts are idempotently backfilled from the legacy authority.
INSERT INTO "BetterAuthAccount" (
    "id", "issuer", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), 'local:credential', u."id"::text, 'credential', u."id", u."passwordHash", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" AS u
WHERE u."passwordHash" IS NOT NULL
ON CONFLICT ("issuer", "accountId") DO NOTHING;

-- CreateIndex
CREATE INDEX "BetterAuthVerification_identifier_idx" ON "BetterAuthVerification"("identifier");

-- CreateIndex
CREATE INDEX "BetterAuthVerification_expiresAt_idx" ON "BetterAuthVerification"("expiresAt");

-- AddForeignKey
ALTER TABLE "BetterAuthSession" ADD CONSTRAINT "BetterAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetterAuthAccount" ADD CONSTRAINT "BetterAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
