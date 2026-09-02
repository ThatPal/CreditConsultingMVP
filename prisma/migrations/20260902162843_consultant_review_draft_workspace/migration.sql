-- CreateEnum
CREATE TYPE "ReviewExceptionStatus" AS ENUM ('OPEN', 'RESOLVED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ReviewFindingStatus" AS ENUM ('PROPOSED', 'APPROVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ReviewDraft" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceVersions" JSONB NOT NULL,
    "profile" JSONB NOT NULL,
    "contextVersion" TEXT NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReviewDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewDraftOverride" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "originalValue" JSONB NOT NULL,
    "effectiveValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceReference" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewDraftOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVerificationException" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "exceptionKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "materiality" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL,
    "status" "ReviewExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB NOT NULL,
    "resolutionReason" TEXT,
    "resolvedByUserId" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReviewVerificationException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewDraft_reviewId_updatedAt_idx" ON "ReviewDraft"("reviewId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDraft_reviewId_version_key" ON "ReviewDraft"("reviewId", "version");

-- CreateIndex
CREATE INDEX "ReviewDraftOverride_reviewId_createdAt_idx" ON "ReviewDraftOverride"("reviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewDraftOverride_draftId_fieldPath_key" ON "ReviewDraftOverride"("draftId", "fieldPath");

-- CreateIndex
CREATE INDEX "ReviewVerificationException_reviewId_status_blocking_idx" ON "ReviewVerificationException"("reviewId", "status", "blocking");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVerificationException_reviewId_exceptionKey_key" ON "ReviewVerificationException"("reviewId", "exceptionKey");

-- AddForeignKey
ALTER TABLE "ReviewDraft" ADD CONSTRAINT "ReviewDraft_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDraftOverride" ADD CONSTRAINT "ReviewDraftOverride_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewDraftOverride" ADD CONSTRAINT "ReviewDraftOverride_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ReviewDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVerificationException" ADD CONSTRAINT "ReviewVerificationException_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CreditReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
