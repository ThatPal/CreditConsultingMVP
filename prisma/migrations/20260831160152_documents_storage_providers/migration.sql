-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('AVAILABLE', 'SUPERSEDED', 'RETENTION_HOLD', 'DELETED');

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowedMimeTypes" TEXT[],
    "allowedExtensions" TEXT[],
    "maximumSizeBytes" INTEGER NOT NULL,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "clientUploadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "retentionCategory" TEXT NOT NULL,
    "retentionDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clientId" UUID NOT NULL,
    "documentTypeId" UUID NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "displayFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "clientVisible" BOOLEAN NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'APPLICATION',
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "supersededAt" TIMESTAMPTZ(3),
    "supersededById" UUID,
    "retentionCategory" TEXT NOT NULL,
    "retainUntil" TIMESTAMPTZ(3),
    "retentionHoldAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_key_key" ON "DocumentType"("key");

-- CreateIndex
CREATE INDEX "DocumentType_enabled_clientUploadEnabled_idx" ON "DocumentType"("enabled", "clientUploadEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Document_supersededById_key" ON "Document"("supersededById");

-- CreateIndex
CREATE INDEX "Document_clientId_status_uploadedAt_idx" ON "Document"("clientId", "status", "uploadedAt");

-- CreateIndex
CREATE INDEX "Document_clientId_documentTypeId_status_uploadedAt_idx" ON "Document"("clientId", "documentTypeId", "status", "uploadedAt");

-- CreateIndex
CREATE INDEX "Document_retainUntil_status_idx" ON "Document"("retainUntil", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageProvider_storageKey_key" ON "Document"("storageProvider", "storageKey");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
