-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('ZERO_APR_CREDIT', 'TOTAL_AVAILABLE_CREDIT', 'BUSINESS_CREDIT', 'PERSONAL_CREDIT', 'BALANCE_TRANSFER_CAPACITY', 'EXISTING_LIMIT_INCREASES', 'REWARDS_POINTS_PORTFOLIO');

-- CreateEnum
CREATE TYPE "GoalScope" AS ENUM ('PERSONAL', 'BUSINESS', 'BOTH');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'PAUSED');

-- CreateTable
CREATE TABLE "ClientGoal" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "goalType" "GoalType" NOT NULL,
    "scope" "GoalScope" NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "currentAmount" DECIMAL(14,2),
    "priority" "GoalPriority" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "achievedAt" TIMESTAMP(3),

    CONSTRAINT "ClientGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientGoal_clientId_status_priority_idx" ON "ClientGoal"("clientId", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ClientGoal_clientId_goalType_scope_key" ON "ClientGoal"("clientId", "goalType", "scope");

-- AddForeignKey
ALTER TABLE "ClientGoal" ADD CONSTRAINT "ClientGoal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
