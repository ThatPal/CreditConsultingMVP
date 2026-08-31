CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY_SCHEDULED', 'FAILED');
CREATE TYPE "IntegrationType" AS ENUM ('EMAIL', 'STORAGE', 'PAYMENT', 'AI', 'CALENDAR', 'OTHER');
CREATE TYPE "IntegrationStatus" AS ENUM ('UNTESTED', 'HEALTHY', 'DEGRADED', 'FAILED', 'DISABLED');

ALTER TABLE "Notification"
  ADD COLUMN "semanticKey" TEXT,
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OPERATIONAL',
  ADD COLUMN "safePayload" JSONB,
  ADD COLUMN "seenAt" TIMESTAMPTZ(3),
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3);

UPDATE "Notification" SET "semanticKey" = 'legacy:' || "id"::text WHERE "semanticKey" IS NULL;
ALTER TABLE "Notification" ALTER COLUMN "semanticKey" SET NOT NULL;

CREATE UNIQUE INDEX "Notification_userId_semanticKey_key" ON "Notification"("userId", "semanticKey");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "lastAttemptAt" TIMESTAMPTZ(3),
  "deliveredAt" TIMESTAMPTZ(3),
  "failureCategory" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_provider_key" ON "NotificationDelivery"("notificationId", "channel", "provider");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_createdAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt", "createdAt");

CREATE TABLE "NotificationTemplate" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationTemplate_key_version_channel_key" ON "NotificationTemplate"("key", "version", "channel");
CREATE INDEX "NotificationTemplate_key_channel_enabled_idx" ON "NotificationTemplate"("key", "channel", "enabled");

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NotificationPreference_userId_category_channel_key" ON "NotificationPreference"("userId", "category", "channel");
CREATE INDEX "NotificationPreference_userId_channel_idx" ON "NotificationPreference"("userId", "channel");

CREATE TABLE "Integration" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "type" "IntegrationType" NOT NULL,
  "provider" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'UNTESTED',
  "configurationMetadata" JSONB,
  "secretReferences" TEXT[] NOT NULL,
  "lastTestedAt" TIMESTAMPTZ(3),
  "lastSuccessAt" TIMESTAMPTZ(3),
  "lastErrorCategory" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Integration_key_key" ON "Integration"("key");
CREATE INDEX "Integration_type_enabled_status_idx" ON "Integration"("type", "enabled", "status");
