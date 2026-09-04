ALTER TABLE "MajorReadinessCase"
  ADD COLUMN "majorApplicationSubmittedAt" TIMESTAMPTZ(3),
  ADD COLUMN "majorApplicationOutcome" VARCHAR(120);
