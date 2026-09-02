ALTER TABLE "CreditReview"
  ADD COLUMN "intendedReportDate" DATE,
  ADD COLUMN "reservationExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "CreditReview_clientId_intendedReportDate_createdAt_idx"
  ON "CreditReview"("clientId", "intendedReportDate", "createdAt");

CREATE UNIQUE INDEX "CreditReview_one_active_per_client_idx"
  ON "CreditReview"("clientId")
  WHERE "status" NOT IN ('COMPLETE', 'CANCELLED');
