-- CreateEnum
CREATE TYPE "GoalIntakeDecision" AS ENUM ('APPLY_SAVED', 'KEEP_CURRENT');

-- CreateEnum
CREATE TYPE "GoalIntakeEffect" AS ENUM ('CREATED', 'UPDATED', 'UNCHANGED', 'KEPT');

-- DropIndex
DROP INDEX "GoalIntakeRegistrationClaim_registrationEmailHash_key";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "goalSetVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GoalIntakeRegistrationClaim" ADD COLUMN     "attachedAt" TIMESTAMPTZ(3),
ADD COLUMN     "attachedClientId" UUID,
ADD COLUMN     "attachedUserId" UUID,
ADD COLUMN     "intakeVersion" INTEGER,
ADD COLUMN     "registrationAttemptKeyHash" TEXT,
ADD COLUMN     "requestHash" TEXT;

-- CreateTable
CREATE TABLE "GoalIntakeResolution" (
    "id" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "decision" "GoalIntakeDecision" NOT NULL,
    "effect" "GoalIntakeEffect" NOT NULL,
    "expectedIntakeVersion" INTEGER NOT NULL,
    "expectedGoalSetVersion" INTEGER NOT NULL,
    "expectedGoalId" UUID,
    "expectedGoalVersion" INTEGER,
    "goalId" UUID NOT NULL,
    "goalVersion" INTEGER NOT NULL,
    "goalRevisionId" UUID,
    "requestHash" TEXT NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalIntakeResolution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoalIntakeResolution_intakeId_key" ON "GoalIntakeResolution"("intakeId");

-- CreateIndex
CREATE INDEX "GoalIntakeResolution_clientId_resolvedAt_idx" ON "GoalIntakeResolution"("clientId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GoalIntakeRegistrationClaim_registrationAttemptKeyHash_key" ON "GoalIntakeRegistrationClaim"("registrationAttemptKeyHash");

-- CreateIndex
CREATE INDEX "GoalIntakeRegistrationClaim_registrationEmailHash_idx" ON "GoalIntakeRegistrationClaim"("registrationEmailHash");

-- CreateIndex
CREATE INDEX "GoalIntakeRegistrationClaim_attachedClientId_expiresAt_idx" ON "GoalIntakeRegistrationClaim"("attachedClientId", "expiresAt");

-- AddForeignKey
ALTER TABLE "GoalIntakeRegistrationClaim" ADD CONSTRAINT "GoalIntakeRegistrationClaim_attachedUserId_fkey" FOREIGN KEY ("attachedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeRegistrationClaim" ADD CONSTRAINT "GoalIntakeRegistrationClaim_attachedClientId_fkey" FOREIGN KEY ("attachedClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "AnonymousGoalIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "ClientGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_goalRevisionId_fkey" FOREIGN KEY ("goalRevisionId") REFERENCES "ClientGoalRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy claims may lack the new attempt fields. New code requires them.
ALTER TABLE "Client" ADD CONSTRAINT "Client_goalSetVersion_nonnegative" CHECK ("goalSetVersion" >= 0);
ALTER TABLE "GoalIntakeRegistrationClaim" ADD CONSTRAINT "GoalIntakeClaim_attachment_complete" CHECK (
 ("attachedAt" IS NULL AND "attachedUserId" IS NULL AND "attachedClientId" IS NULL) OR
 ("attachedAt" IS NOT NULL AND "attachedUserId" IS NOT NULL AND "attachedClientId" IS NOT NULL)
);
ALTER TABLE "GoalIntakeRegistrationClaim" ADD CONSTRAINT "GoalIntakeClaim_attempt_complete" CHECK (
 ("registrationAttemptKeyHash" IS NULL AND "requestHash" IS NULL AND "intakeVersion" IS NULL) OR
 ("registrationAttemptKeyHash" IS NOT NULL AND "requestHash" IS NOT NULL AND "intakeVersion" IS NOT NULL AND "intakeVersion" > 0)
);
ALTER TABLE "GoalIntakeResolution" ADD CONSTRAINT "GoalIntakeResolution_versions_valid" CHECK (
 "expectedIntakeVersion" > 0 AND "expectedGoalSetVersion" >= 0 AND "goalVersion" > 0 AND
 (("expectedGoalId" IS NULL AND "expectedGoalVersion" IS NULL) OR ("expectedGoalId" IS NOT NULL AND "expectedGoalVersion" IS NOT NULL AND "expectedGoalVersion" > 0))
);
