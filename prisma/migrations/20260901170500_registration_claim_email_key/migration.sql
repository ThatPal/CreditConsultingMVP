ALTER TABLE "GoalIntakeRegistrationClaim"
  RENAME COLUMN "prospectiveUserId" TO "registrationEmailHash";
ALTER TABLE "GoalIntakeRegistrationClaim"
  ALTER COLUMN "registrationEmailHash" TYPE TEXT USING "registrationEmailHash"::TEXT;
ALTER INDEX "GoalIntakeRegistrationClaim_prospectiveUserId_key"
  RENAME TO "GoalIntakeRegistrationClaim_registrationEmailHash_key";
