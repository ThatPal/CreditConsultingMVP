CREATE TYPE "MajorReadinessStatus" AS ENUM ('INTAKE','ASSESSMENT','PREPARATION','COORDINATION','REASSESSMENT','COMPLETE');
CREATE TYPE "MajorReadinessRecommendationType" AS ENUM ('PROCEED_NOW','PREPARE_FIRST','REASSESS_LATER');
CREATE TYPE "CoordinationDecisionType" AS ENUM ('NO_RESTRICTION','PAUSE_CARD_ACTIVITY','LIMIT_CARD_ACTIVITY');
CREATE TYPE "CreditActivityRestrictionScope" AS ENUM ('CYCLE','STRATEGY','SCHEDULING','LIVE_EXECUTION');

CREATE TABLE "MajorReadinessCase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "intentType" VARCHAR(80) NOT NULL,
  "targetTiming" VARCHAR(160), "clientContext" VARCHAR(1000), "status" "MajorReadinessStatus" NOT NULL DEFAULT 'INTAKE',
  "version" INTEGER NOT NULL DEFAULT 1, "profileStateId" UUID, "sourceReviewId" UUID, "serviceEntitlementId" UUID,
  "sourceMajorCheckId" UUID, "preparationPlanId" UUID, "currentRecommendationId" UUID, "currentDecisionId" UUID,
  "finalizedAt" TIMESTAMPTZ(3), "createdByUserId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "MajorReadinessCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MajorReadinessCase_clientId_status_updatedAt_idx" ON "MajorReadinessCase"("clientId","status","updatedAt");

CREATE TABLE "MajorReadinessRecommendation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "caseId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "type" "MajorReadinessRecommendationType" NOT NULL, "clientSafeExplanation" VARCHAR(3000) NOT NULL,
  "internalRationale" VARCHAR(3000), "sourceFingerprint" TEXT NOT NULL, "sourceSnapshot" JSONB NOT NULL,
  "aiJobId" UUID, "aiProviderMetadata" JSONB, "approvedByUserId" UUID, "approvedAt" TIMESTAMPTZ(3),
  "supersededAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MajorReadinessRecommendation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MajorReadinessRecommendation_caseId_version_key" ON "MajorReadinessRecommendation"("caseId","version");
CREATE INDEX "MajorReadinessRecommendation_caseId_approvedAt_idx" ON "MajorReadinessRecommendation"("caseId","approvedAt");

CREATE TABLE "CoordinationDecision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "caseId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "type" "CoordinationDecisionType" NOT NULL, "clientSafeExplanation" VARCHAR(3000) NOT NULL,
  "internalRationale" VARCHAR(3000), "sourceRecommendationId" UUID NOT NULL, "effectiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMPTZ(3), "decidedByUserId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoordinationDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoordinationDecision_caseId_version_key" ON "CoordinationDecision"("caseId","version");
CREATE INDEX "CoordinationDecision_caseId_effectiveAt_idx" ON "CoordinationDecision"("caseId","effectiveAt");

CREATE TABLE "ClientCreditActivityRestriction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clientId" UUID NOT NULL, "caseId" UUID NOT NULL, "decisionId" UUID NOT NULL,
  "scope" "CreditActivityRestrictionScope" NOT NULL, "reasonCode" TEXT NOT NULL, "effectiveAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMPTZ(3), "clearedByUserId" UUID, "clearReason" VARCHAR(1000), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientCreditActivityRestriction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClientCreditActivityRestriction_decisionId_scope_key" ON "ClientCreditActivityRestriction"("decisionId","scope");
CREATE INDEX "ClientCreditActivityRestriction_clientId_scope_clearedAt_idx" ON "ClientCreditActivityRestriction"("clientId","scope","clearedAt");

CREATE TABLE "MajorReadinessEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "caseId" UUID NOT NULL, "clientId" UUID NOT NULL, "type" TEXT NOT NULL,
  "actorUserId" UUID, "payload" JSONB NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MajorReadinessEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MajorReadinessEvent_caseId_createdAt_id_idx" ON "MajorReadinessEvent"("caseId","createdAt","id");
CREATE INDEX "MajorReadinessEvent_clientId_createdAt_idx" ON "MajorReadinessEvent"("clientId","createdAt");

ALTER TABLE "MajorReadinessRecommendation" ADD CONSTRAINT "MajorReadinessRecommendation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MajorReadinessCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoordinationDecision" ADD CONSTRAINT "CoordinationDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MajorReadinessCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientCreditActivityRestriction" ADD CONSTRAINT "ClientCreditActivityRestriction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MajorReadinessCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientCreditActivityRestriction" ADD CONSTRAINT "ClientCreditActivityRestriction_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "CoordinationDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MajorReadinessEvent" ADD CONSTRAINT "MajorReadinessEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "MajorReadinessCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
