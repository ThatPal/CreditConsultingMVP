ALTER TABLE "ClientGoal" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ClientGoalRevision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "goalId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "scope" "GoalScope" NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "allowAnnualFee" BOOLEAN NOT NULL,
    "priority" "GoalPriority" NOT NULL,
    "status" "GoalStatus" NOT NULL,
    "changedById" UUID,
    "changeSource" TEXT NOT NULL DEFAULT 'CLIENT_COMMAND',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientGoalRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnonymousGoalIntake" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tokenHash" TEXT NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "scope" "GoalScope" NOT NULL,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "allowAnnualFee" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "consumedByClientId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "AnonymousGoalIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientGoalRevision_goalId_version_key" ON "ClientGoalRevision"("goalId", "version");
CREATE INDEX "ClientGoalRevision_clientId_createdAt_idx" ON "ClientGoalRevision"("clientId", "createdAt");
CREATE UNIQUE INDEX "AnonymousGoalIntake_tokenHash_key" ON "AnonymousGoalIntake"("tokenHash");
CREATE INDEX "AnonymousGoalIntake_consumedByClientId_idx" ON "AnonymousGoalIntake"("consumedByClientId");
CREATE INDEX "AnonymousGoalIntake_expiresAt_consumedAt_idx" ON "AnonymousGoalIntake"("expiresAt", "consumedAt");

ALTER TABLE "ClientGoalRevision" ADD CONSTRAINT "ClientGoalRevision_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "ClientGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientGoalRevision" ADD CONSTRAINT "ClientGoalRevision_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnonymousGoalIntake" ADD CONSTRAINT "AnonymousGoalIntake_consumedByClientId_fkey" FOREIGN KEY ("consumedByClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ClientGoalRevision" ("goalId", "clientId", "version", "goalType", "scope", "targetAmount", "allowAnnualFee", "priority", "status", "changeSource", "createdAt")
SELECT "id", "clientId", 1, "goalType", "scope", "targetAmount", "allowAnnualFee", "priority", "status", 'MIGRATION_BASELINE', "createdAt"
FROM "ClientGoal";
