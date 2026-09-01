CREATE TYPE "JourneyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETE');
CREATE TYPE "NurturePeriodStatus" AS ENUM ('ACTIVE', 'COMPLETE', 'CANCELLED');
CREATE TYPE "CreditProfileStateStatus" AS ENUM ('NOT_AVAILABLE', 'REVIEW_IN_PROGRESS', 'CURRENT', 'STALE');

CREATE TABLE "CreditJourney" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "status" "JourneyStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CreditJourney_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CycleGoalSnapshot" (
  "id" UUID NOT NULL,
  "cycleId" UUID NOT NULL,
  "sourceGoalId" UUID NOT NULL,
  "sourceGoalVersion" INTEGER NOT NULL,
  "goalType" "GoalType" NOT NULL,
  "scope" "GoalScope" NOT NULL,
  "targetAmount" DECIMAL(14,2),
  "allowAnnualFee" BOOLEAN NOT NULL,
  "cardTypePreference" "CardTypePreference" NOT NULL,
  "offerPreferences" "GoalOfferPreference"[] DEFAULT ARRAY[]::"GoalOfferPreference"[],
  "feePreference" "FeePreference" NOT NULL,
  "preferenceNote" VARCHAR(500),
  "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CycleGoalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NurturePeriod" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "journeyId" UUID NOT NULL,
  "status" "NurturePeriodStatus" NOT NULL DEFAULT 'ACTIVE',
  "reasonCode" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedEnd" TIMESTAMPTZ(3),
  "endedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NurturePeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditProfileState" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "status" "CreditProfileStateStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
  "sourceReviewId" UUID,
  "effectiveAt" TIMESTAMPTZ(3),
  "staleAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "CreditProfileState_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ApplicationCycle" ADD COLUMN "journeyId" UUID;

CREATE UNIQUE INDEX "CreditJourney_clientId_key" ON "CreditJourney"("clientId");
CREATE INDEX "CreditJourney_status_updatedAt_idx" ON "CreditJourney"("status", "updatedAt");
CREATE UNIQUE INDEX "CycleGoalSnapshot_cycleId_key" ON "CycleGoalSnapshot"("cycleId");
CREATE INDEX "CycleGoalSnapshot_sourceGoalId_capturedAt_idx" ON "CycleGoalSnapshot"("sourceGoalId", "capturedAt");
CREATE INDEX "NurturePeriod_clientId_status_startedAt_idx" ON "NurturePeriod"("clientId", "status", "startedAt");
CREATE INDEX "NurturePeriod_journeyId_startedAt_idx" ON "NurturePeriod"("journeyId", "startedAt");
CREATE UNIQUE INDEX "CreditProfileState_clientId_key" ON "CreditProfileState"("clientId");
CREATE INDEX "CreditProfileState_status_updatedAt_idx" ON "CreditProfileState"("status", "updatedAt");
CREATE INDEX "ApplicationCycle_journeyId_startedAt_idx" ON "ApplicationCycle"("journeyId", "startedAt");

ALTER TABLE "CreditJourney" ADD CONSTRAINT "CreditJourney_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationCycle" ADD CONSTRAINT "ApplicationCycle_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CreditJourney"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CycleGoalSnapshot" ADD CONSTRAINT "CycleGoalSnapshot_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ApplicationCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NurturePeriod" ADD CONSTRAINT "NurturePeriod_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NurturePeriod" ADD CONSTRAINT "NurturePeriod_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CreditJourney"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditProfileState" ADD CONSTRAINT "CreditProfileState_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CreditJourney" ("id", "clientId", "status", "startedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id", 'ACTIVE'::"JourneyStatus",
       COALESCE(MIN(ac."startedAt"), c."createdAt"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Client" c
LEFT JOIN "ApplicationCycle" ac ON ac."clientId" = c."id"
GROUP BY c."id", c."createdAt";

UPDATE "ApplicationCycle" ac
SET "journeyId" = journey."id"
FROM "CreditJourney" journey
WHERE journey."clientId" = ac."clientId";

ALTER TABLE "ApplicationCycle" ALTER COLUMN "journeyId" SET NOT NULL;

INSERT INTO "CycleGoalSnapshot" (
  "id", "cycleId", "sourceGoalId", "sourceGoalVersion", "goalType", "scope",
  "targetAmount", "allowAnnualFee", "cardTypePreference", "offerPreferences",
  "feePreference", "preferenceNote", "capturedAt"
)
SELECT gen_random_uuid(), ac."id", goal."id", goal."version", goal."goalType", goal."scope",
       goal."targetAmount", goal."allowAnnualFee", goal."cardTypePreference", goal."offerPreferences",
       goal."feePreference", goal."preferenceNote", ac."startedAt"
FROM "ApplicationCycle" ac
JOIN LATERAL (
  SELECT g.* FROM "ClientGoal" g
  WHERE g."clientId" = ac."clientId"
  ORDER BY CASE WHEN g."priority" = 'PRIMARY' THEN 0 ELSE 1 END, g."createdAt", g."id"
  LIMIT 1
) goal ON TRUE;

INSERT INTO "CreditProfileState" ("id", "clientId", "status", "sourceReviewId", "effectiveAt", "staleAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c."id",
       CASE WHEN review."id" IS NULL THEN 'NOT_AVAILABLE'::"CreditProfileStateStatus"
            WHEN review."status" = 'COMPLETE' AND (review."readinessExpiresAt" IS NULL OR review."readinessExpiresAt" > CURRENT_TIMESTAMP) THEN 'CURRENT'::"CreditProfileStateStatus"
            WHEN review."status" = 'COMPLETE' THEN 'STALE'::"CreditProfileStateStatus"
            ELSE 'REVIEW_IN_PROGRESS'::"CreditProfileStateStatus" END,
       review."id", COALESCE(review."completedAt", review."submittedAt"), review."readinessExpiresAt", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Client" c
LEFT JOIN LATERAL (
  SELECT r.* FROM "CreditReview" r WHERE r."clientId" = c."id"
  ORDER BY r."createdAt" DESC, r."id" DESC LIMIT 1
) review ON TRUE;
