ALTER TYPE "CreditReviewStatus" ADD VALUE 'INFORMATION_REQUESTED' AFTER 'INTAKE_REQUIRED';

ALTER TABLE "ReviewIntake"
  ADD COLUMN "informationRequest" JSONB,
  ADD COLUMN "informationRequestedAt" TIMESTAMP(3),
  ADD COLUMN "informationResolvedAt" TIMESTAMP(3);
