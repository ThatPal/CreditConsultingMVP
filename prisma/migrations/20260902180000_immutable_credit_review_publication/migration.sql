CREATE TABLE "PublishedCreditReview" (
  "id" UUID NOT NULL,
  "reviewId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceVersions" JSONB NOT NULL,
  "clientSafeProjection" JSONB NOT NULL,
  "recommendation" "ReviewRecommendation" NOT NULL,
  "publishedByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishedCreditReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PublishedCreditReview_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PublishedCreditReview_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "CreditSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublishedCreditReview_reviewId_key" ON "PublishedCreditReview"("reviewId");
CREATE UNIQUE INDEX "PublishedCreditReview_snapshotId_key" ON "PublishedCreditReview"("snapshotId");
CREATE UNIQUE INDEX "PublishedCreditReview_idempotencyKey_key" ON "PublishedCreditReview"("idempotencyKey");
CREATE INDEX "PublishedCreditReview_clientId_publishedAt_idx" ON "PublishedCreditReview"("clientId", "publishedAt");
