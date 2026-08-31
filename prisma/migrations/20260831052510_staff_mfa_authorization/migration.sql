-- CreateEnum
CREATE TYPE "ClientAccessScope" AS ENUM ('READ', 'CONSULTANT_WORK', 'SUPPORT_ONLY');

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH');

-- AlterTable
ALTER TABLE "BetterAuthSession" ADD COLUMN     "staffMfaVerifiedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BetterAuthTwoFactor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "BetterAuthTwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleCapability" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role" "UserRole" NOT NULL,
    "capability" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffClientAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "staffUserId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffClientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAccessGrant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "granteeId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "scope" "ClientAccessScope" NOT NULL,
    "allowedCapabilities" TEXT[],
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "grantorId" UUID NOT NULL,
    "revokerId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClientAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "clientId" UUID,
    "eventType" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO',
    "category" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetterAuthTwoFactor_secret_key" ON "BetterAuthTwoFactor"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "BetterAuthTwoFactor_userId_key" ON "BetterAuthTwoFactor"("userId");

-- CreateIndex
CREATE INDEX "BetterAuthTwoFactor_userId_idx" ON "BetterAuthTwoFactor"("userId");

-- CreateIndex
CREATE INDEX "RoleCapability_capability_role_idx" ON "RoleCapability"("capability", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleCapability_role_capability_key" ON "RoleCapability"("role", "capability");

-- CreateIndex
CREATE INDEX "StaffClientAssignment_clientId_deactivatedAt_idx" ON "StaffClientAssignment"("clientId", "deactivatedAt");

-- CreateIndex
CREATE INDEX "StaffClientAssignment_staffUserId_deactivatedAt_idx" ON "StaffClientAssignment"("staffUserId", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffClientAssignment_staffUserId_clientId_key" ON "StaffClientAssignment"("staffUserId", "clientId");

-- CreateIndex
CREATE INDEX "ClientAccessGrant_granteeId_clientId_startsAt_expiresAt_rev_idx" ON "ClientAccessGrant"("granteeId", "clientId", "startsAt", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "ClientAccessGrant_clientId_scope_revokedAt_idx" ON "ClientAccessGrant"("clientId", "scope", "revokedAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_actorId_createdAt_idx" ON "SecurityEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_clientId_createdAt_idx" ON "SecurityEvent"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "BetterAuthTwoFactor" ADD CONSTRAINT "BetterAuthTwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClientAssignment" ADD CONSTRAINT "StaffClientAssignment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffClientAssignment" ADD CONSTRAINT "StaffClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_grantorId_fkey" FOREIGN KEY ("grantorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAccessGrant" ADD CONSTRAINT "ClientAccessGrant_revokerId_fkey" FOREIGN KEY ("revokerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
