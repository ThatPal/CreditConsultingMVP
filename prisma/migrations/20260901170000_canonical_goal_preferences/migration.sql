CREATE TYPE "CardTypePreference" AS ENUM ('UNSECURED_PREFERRED', 'OPEN_TO_SECURED', 'SECURED_DESIRED', 'NO_PREFERENCE');
CREATE TYPE "GoalOfferPreference" AS ENUM ('ZERO_APR', 'BALANCE_TRANSFER', 'REWARDS_POINTS');
CREATE TYPE "FeePreference" AS ENUM ('NO_ANNUAL_FEE_ONLY', 'PROMOTIONAL_NO_FEE_ACCEPTABLE', 'PREFER_NO_FEE_OPEN', 'FEE_ACCEPTABLE');

ALTER TABLE "ClientGoal"
  ADD COLUMN "cardTypePreference" "CardTypePreference" NOT NULL DEFAULT 'NO_PREFERENCE',
  ADD COLUMN "offerPreferences" "GoalOfferPreference"[] NOT NULL DEFAULT ARRAY[]::"GoalOfferPreference"[],
  ADD COLUMN "feePreference" "FeePreference" NOT NULL DEFAULT 'NO_ANNUAL_FEE_ONLY',
  ADD COLUMN "preferenceNote" VARCHAR(500);

ALTER TABLE "ClientGoalRevision"
  ADD COLUMN "cardTypePreference" "CardTypePreference" NOT NULL DEFAULT 'NO_PREFERENCE',
  ADD COLUMN "offerPreferences" "GoalOfferPreference"[] NOT NULL DEFAULT ARRAY[]::"GoalOfferPreference"[],
  ADD COLUMN "feePreference" "FeePreference" NOT NULL DEFAULT 'NO_ANNUAL_FEE_ONLY',
  ADD COLUMN "preferenceNote" VARCHAR(500);

ALTER TABLE "AnonymousGoalIntake"
  ADD COLUMN "cardTypePreference" "CardTypePreference" NOT NULL DEFAULT 'NO_PREFERENCE',
  ADD COLUMN "offerPreferences" "GoalOfferPreference"[] NOT NULL DEFAULT ARRAY[]::"GoalOfferPreference"[],
  ADD COLUMN "feePreference" "FeePreference" NOT NULL DEFAULT 'NO_ANNUAL_FEE_ONLY',
  ADD COLUMN "preferenceNote" VARCHAR(500),
  ADD COLUMN "firstName" VARCHAR(100),
  ADD COLUMN "lastName" VARCHAR(100),
  ADD COLUMN "email" VARCHAR(320),
  ADD COLUMN "phone" VARCHAR(32);

UPDATE "ClientGoal"
SET "feePreference" = CASE WHEN "allowAnnualFee" THEN 'FEE_ACCEPTABLE'::"FeePreference" ELSE 'NO_ANNUAL_FEE_ONLY'::"FeePreference" END,
    "offerPreferences" = CASE WHEN "goalType" = 'ZERO_APR_CREDIT' THEN ARRAY['ZERO_APR'::"GoalOfferPreference"] ELSE ARRAY[]::"GoalOfferPreference"[] END;

UPDATE "ClientGoalRevision"
SET "feePreference" = CASE WHEN "allowAnnualFee" THEN 'FEE_ACCEPTABLE'::"FeePreference" ELSE 'NO_ANNUAL_FEE_ONLY'::"FeePreference" END,
    "offerPreferences" = CASE WHEN "goalType" = 'ZERO_APR_CREDIT' THEN ARRAY['ZERO_APR'::"GoalOfferPreference"] ELSE ARRAY[]::"GoalOfferPreference"[] END;

UPDATE "AnonymousGoalIntake"
SET "firstName" = 'Prospective', "lastName" = 'Client', "email" = CONCAT('legacy+', "id", '@intake.invalid'),
    "feePreference" = CASE WHEN "allowAnnualFee" THEN 'FEE_ACCEPTABLE'::"FeePreference" ELSE 'NO_ANNUAL_FEE_ONLY'::"FeePreference" END,
    "offerPreferences" = CASE WHEN "goalType" = 'ZERO_APR_CREDIT' THEN ARRAY['ZERO_APR'::"GoalOfferPreference"] ELSE ARRAY[]::"GoalOfferPreference"[] END;

ALTER TABLE "AnonymousGoalIntake"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL,
  ALTER COLUMN "email" SET NOT NULL;

CREATE TABLE "GoalIntakeRegistrationClaim" (
  "id" UUID NOT NULL,
  "prospectiveUserId" UUID NOT NULL,
  "intakeTokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoalIntakeRegistrationClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GoalIntakeRegistrationClaim_prospectiveUserId_key" ON "GoalIntakeRegistrationClaim"("prospectiveUserId");
CREATE INDEX "GoalIntakeRegistrationClaim_expiresAt_idx" ON "GoalIntakeRegistrationClaim"("expiresAt");
CREATE INDEX "GoalIntakeRegistrationClaim_intakeTokenHash_idx" ON "GoalIntakeRegistrationClaim"("intakeTokenHash");
