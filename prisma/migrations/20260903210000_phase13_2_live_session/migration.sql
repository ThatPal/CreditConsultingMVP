CREATE TYPE "ApplicationSessionStatus" AS ENUM ('SCHEDULED', 'READY', 'WAITING_FOR_CLIENT', 'WAITING_FOR_CONSULTANT', 'LIVE', 'PAUSED', 'ENDED');
CREATE TYPE "SessionParticipantRole" AS ENUM ('CLIENT', 'CONSULTANT');

CREATE TABLE "ApplicationSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "consultantId" UUID NOT NULL,
  "roundId" UUID NOT NULL, "appointmentId" UUID NOT NULL, "strategyVersionId" UUID NOT NULL,
  "sourceFingerprint" TEXT NOT NULL, "coordinationVersion" TEXT, "status" "ApplicationSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "pauseReason" VARCHAR(500), "supervisionRequired" BOOLEAN NOT NULL DEFAULT true, "startedAt" TIMESTAMPTZ(3), "endedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ApplicationSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApplicationSession_roundId_key" ON "ApplicationSession"("roundId");
CREATE UNIQUE INDEX "ApplicationSession_appointmentId_key" ON "ApplicationSession"("appointmentId");
CREATE INDEX "ApplicationSession_consultantId_status_updatedAt_id_idx" ON "ApplicationSession"("consultantId", "status", "updatedAt", "id");
CREATE INDEX "ApplicationSession_clientId_status_updatedAt_id_idx" ON "ApplicationSession"("clientId", "status", "updatedAt", "id");
ALTER TABLE "ApplicationSession" ADD CONSTRAINT "ApplicationSession_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CreditCardRound"("id") ON DELETE RESTRICT;
ALTER TABLE "ApplicationSession" ADD CONSTRAINT "ApplicationSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT;
ALTER TABLE "ApplicationSession" ADD CONSTRAINT "ApplicationSession_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT;

CREATE TABLE "SessionPresenceLease" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" UUID NOT NULL, "userId" UUID NOT NULL, "role" "SessionParticipantRole" NOT NULL,
  "connectionId" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL, "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SessionPresenceLease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SessionPresenceLease_sessionId_connectionId_key" ON "SessionPresenceLease"("sessionId", "connectionId");
CREATE INDEX "SessionPresenceLease_sessionId_role_expiresAt_idx" ON "SessionPresenceLease"("sessionId", "role", "expiresAt");
CREATE INDEX "SessionPresenceLease_userId_expiresAt_idx" ON "SessionPresenceLease"("userId", "expiresAt");
ALTER TABLE "SessionPresenceLease" ADD CONSTRAINT "SessionPresenceLease_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApplicationSession"("id") ON DELETE CASCADE;

CREATE TABLE "SessionMessage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sessionId" UUID NOT NULL, "clientId" UUID NOT NULL, "authorUserId" UUID NOT NULL,
  "authorRole" "SessionParticipantRole" NOT NULL, "body" VARCHAR(2000) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SessionMessage_sessionId_createdAt_id_idx" ON "SessionMessage"("sessionId", "createdAt", "id");
CREATE INDEX "SessionMessage_clientId_createdAt_idx" ON "SessionMessage"("clientId", "createdAt");
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ApplicationSession"("id") ON DELETE CASCADE;
