CREATE TYPE "AppointmentStatus" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "CalendarSyncStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'SYNCED', 'RETRY_REQUIRED');

CREATE TABLE "ConsultantAvailabilityRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "consultantId" UUID NOT NULL,
  "weekday" INTEGER NOT NULL, "startMinute" INTEGER NOT NULL, "endMinute" INTEGER NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York', "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultantAvailabilityRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_rule_bounds" CHECK ("weekday" BETWEEN 0 AND 6 AND "startMinute" BETWEEN 0 AND 1439 AND "endMinute" BETWEEN 1 AND 1440 AND "endMinute" > "startMinute")
);
CREATE INDEX "ConsultantAvailabilityRule_consultantId_active_weekday_idx" ON "ConsultantAvailabilityRule"("consultantId", "active", "weekday");

CREATE TABLE "ConsultantAvailabilityException" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "consultantId" UUID NOT NULL,
  "startsAt" TIMESTAMPTZ(3) NOT NULL, "endsAt" TIMESTAMPTZ(3) NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT false, "note" VARCHAR(240),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsultantAvailabilityException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "availability_exception_bounds" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "ConsultantAvailabilityException_consultantId_startsAt_endsAt_idx" ON "ConsultantAvailabilityException"("consultantId", "startsAt", "endsAt");

CREATE TABLE "Appointment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "consultantId" UUID NOT NULL,
  "roundId" UUID NOT NULL, "strategyVersionId" UUID NOT NULL,
  "appointmentType" TEXT NOT NULL DEFAULT 'GUIDED_APPLICATION_SESSION',
  "startsAt" TIMESTAMPTZ(3) NOT NULL, "endsAt" TIMESTAMPTZ(3) NOT NULL, "timezone" TEXT NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'BOOKED', "rescheduledFromId" UUID,
  "cancellationReason" VARCHAR(500), "externalSyncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  "externalReference" TEXT, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_time_bounds" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT,
  CONSTRAINT "Appointment_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "Appointment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CreditCardRound"("id") ON DELETE RESTRICT,
  CONSTRAINT "Appointment_strategyVersionId_fkey" FOREIGN KEY ("strategyVersionId") REFERENCES "StrategyVersion"("id") ON DELETE RESTRICT,
  CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "Appointment_one_active_round" ON "Appointment"("roundId") WHERE "status" = 'BOOKED';
CREATE INDEX "Appointment_consultantId_startsAt_endsAt_status_idx" ON "Appointment"("consultantId", "startsAt", "endsAt", "status");
CREATE INDEX "Appointment_clientId_startsAt_status_idx" ON "Appointment"("clientId", "startsAt", "status");
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_consultant_no_overlap" EXCLUDE USING gist ("consultantId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&) WHERE (status = 'BOOKED');
