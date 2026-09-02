-- CreateEnum
CREATE TYPE "AIJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'RETRYABLE_FAILURE', 'NON_RETRYABLE_FAILURE', 'SCHEMA_INVALID', 'STALE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIAuthorityLevel" AS ENUM ('FACTUAL_LEVEL_1');

-- CreateEnum
CREATE TYPE "AIConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "AIProcessDefinition" (
    "id" UUID NOT NULL,
    "processKey" TEXT NOT NULL,
    "processVersion" INTEGER NOT NULL,
    "authorityLevel" "AIAuthorityLevel" NOT NULL DEFAULT 'FACTUAL_LEVEL_1',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "modelProfile" TEXT NOT NULL,
    "inputSchemaVersion" INTEGER NOT NULL,
    "outputSchemaVersion" INTEGER NOT NULL,
    "instructionVersion" TEXT NOT NULL,
    "knowledgeReferences" JSONB,
    "retryPolicy" JSONB NOT NULL,
    "dataClassification" TEXT NOT NULL,
    "allowedContext" JSONB NOT NULL,
    "domainConsumer" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMPTZ(3),

    CONSTRAINT "AIProcessDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJob" (
    "id" UUID NOT NULL,
    "processDefinitionId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "correlationId" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" UUID NOT NULL,
    "sourceIdentity" TEXT NOT NULL,
    "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputSchemaVersion" INTEGER NOT NULL,
    "outputSchemaVersion" INTEGER NOT NULL,
    "sourceVersions" JSONB NOT NULL,
    "inputEnvelope" JSONB NOT NULL,
    "currentAttempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "failureCategory" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIJobOutput" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "outputVersion" INTEGER NOT NULL,
    "outputSchemaVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "exceptions" JSONB NOT NULL,
    "confidence" "AIConfidence" NOT NULL,
    "evidence" JSONB NOT NULL,
    "humanReview" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "sourceVersions" JSONB NOT NULL,
    "staleAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIJobOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditReportArtifact" (
    "id" UUID NOT NULL,
    "reportDocumentId" UUID NOT NULL,
    "aiJobId" UUID NOT NULL,
    "aiJobOutputId" UUID NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactVersion" INTEGER NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "staleAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditReportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIProcessDefinition_processKey_enabled_processVersion_idx" ON "AIProcessDefinition"("processKey", "enabled", "processVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AIProcessDefinition_processKey_processVersion_key" ON "AIProcessDefinition"("processKey", "processVersion");

-- CreateIndex
CREATE INDEX "AIJob_status_availableAt_createdAt_idx" ON "AIJob"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "AIJob_clientId_relatedEntityType_relatedEntityId_idx" ON "AIJob"("clientId", "relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "AIJob_correlationId_idx" ON "AIJob"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIJob_processDefinitionId_sourceIdentity_correlationId_key" ON "AIJob"("processDefinitionId", "sourceIdentity", "correlationId");

-- CreateIndex
CREATE INDEX "AIJobOutput_jobId_staleAt_createdAt_idx" ON "AIJobOutput"("jobId", "staleAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIJobOutput_jobId_outputVersion_key" ON "AIJobOutput"("jobId", "outputVersion");

-- CreateIndex
CREATE INDEX "CreditReportArtifact_reportDocumentId_artifactType_current_idx" ON "CreditReportArtifact"("reportDocumentId", "artifactType", "current");

-- CreateIndex
CREATE INDEX "CreditReportArtifact_aiJobId_aiJobOutputId_idx" ON "CreditReportArtifact"("aiJobId", "aiJobOutputId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditReportArtifact_reportDocumentId_artifactType_artifact_key" ON "CreditReportArtifact"("reportDocumentId", "artifactType", "artifactVersion");

-- AddForeignKey
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_processDefinitionId_fkey" FOREIGN KEY ("processDefinitionId") REFERENCES "AIProcessDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIJobOutput" ADD CONSTRAINT "AIJobOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AIJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportArtifact" ADD CONSTRAINT "CreditReportArtifact_reportDocumentId_fkey" FOREIGN KEY ("reportDocumentId") REFERENCES "CreditReportDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportArtifact" ADD CONSTRAINT "CreditReportArtifact_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditReportArtifact" ADD CONSTRAINT "CreditReportArtifact_aiJobOutputId_fkey" FOREIGN KEY ("aiJobOutputId") REFERENCES "AIJobOutput"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
