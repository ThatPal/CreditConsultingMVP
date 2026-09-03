-- CreateEnum
CREATE TYPE "CardProductLifecycle" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "CardOfferStatus" AS ENUM ('CURRENT', 'SUPERSEDED', 'STALE');

-- CreateEnum
CREATE TYPE "CardCatalogCandidateStatus" AS ENUM ('PENDING', 'CONFLICT', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateEnum
CREATE TYPE "CardCatalogCandidateKind" AS ENUM ('NEW_PRODUCT', 'OFFER_CHANGE');

-- CreateEnum
CREATE TYPE "CardInsightStatus" AS ENUM ('PREPARED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'STALE', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "ClientCard" ADD COLUMN     "cardProductId" UUID;

-- CreateTable
CREATE TABLE "CardIssuer" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoAssetId" UUID,
    "aliases" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CardIssuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardProduct" (
    "id" UUID NOT NULL,
    "issuerId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "audience" "ClientCardScope" NOT NULL,
    "portfolioType" "ClientCardPortfolioType" NOT NULL,
    "secured" BOOLEAN NOT NULL DEFAULT false,
    "reportsToBureaus" BOOLEAN,
    "features" JSONB NOT NULL,
    "tags" TEXT[],
    "lifecycle" "CardProductLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "currentOfferVersionId" UUID,
    "currentInsightVersionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "retiredAt" TIMESTAMPTZ(3),

    CONSTRAINT "CardProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardOfferVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CardOfferStatus" NOT NULL DEFAULT 'CURRENT',
    "facts" JSONB NOT NULL,
    "materialFingerprint" TEXT NOT NULL,
    "sourceEvidence" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freshUntil" TIMESTAMPTZ(3),
    "staleAt" TIMESTAMPTZ(3),
    "supersededAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardOfferVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCardIdentityLink" (
    "id" UUID NOT NULL,
    "clientCardId" UUID NOT NULL,
    "productId" UUID,
    "evidence" JSONB NOT NULL,
    "actorId" UUID,
    "linkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinkedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ClientCardIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCardWishlist" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClientCardWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSource" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "allowedHosts" TEXT[],
    "official" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CardSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSourceMapping" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "productId" UUID NOT NULL,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSourceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCatalogCandidate" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "sourceIdentity" TEXT NOT NULL,
    "kind" "CardCatalogCandidateKind" NOT NULL,
    "status" "CardCatalogCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "matchedProductId" UUID,
    "normalizedPayload" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "conflicts" JSONB NOT NULL,
    "materialConflict" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reviewedById" UUID,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CardCatalogCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInsightVersion" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "offerVersionId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "CardInsightStatus" NOT NULL DEFAULT 'PREPARED',
    "clientSafeSummary" TEXT NOT NULL,
    "internalRationale" TEXT,
    "strengths" JSONB NOT NULL,
    "cautions" JSONB NOT NULL,
    "confidence" "AIConfidence",
    "processKey" TEXT,
    "processVersion" INTEGER,
    "modelProvenance" JSONB,
    "evidence" JSONB NOT NULL,
    "proposedPayload" JSONB,
    "approvedById" UUID,
    "approvalNote" TEXT,
    "approvedAt" TIMESTAMPTZ(3),
    "staleAt" TIMESTAMPTZ(3),
    "supersededAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardInsightVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardIssuer_slug_key" ON "CardIssuer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_slug_key" ON "CardProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_currentOfferVersionId_key" ON "CardProduct"("currentOfferVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_currentInsightVersionId_key" ON "CardProduct"("currentInsightVersionId");

-- CreateIndex
CREATE INDEX "CardProduct_lifecycle_audience_portfolioType_idx" ON "CardProduct"("lifecycle", "audience", "portfolioType");

-- CreateIndex
CREATE UNIQUE INDEX "CardProduct_issuerId_canonicalName_key" ON "CardProduct"("issuerId", "canonicalName");

-- CreateIndex
CREATE INDEX "CardOfferVersion_productId_status_publishedAt_idx" ON "CardOfferVersion"("productId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardOfferVersion_productId_version_key" ON "CardOfferVersion"("productId", "version");

-- CreateIndex
CREATE INDEX "ClientCardIdentityLink_clientCardId_linkedAt_idx" ON "ClientCardIdentityLink"("clientCardId", "linkedAt");

-- CreateIndex
CREATE INDEX "ClientCardWishlist_clientId_createdAt_idx" ON "ClientCardWishlist"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCardWishlist_clientId_productId_key" ON "ClientCardWishlist"("clientId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CardSource_key_key" ON "CardSource"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CardSourceMapping_sourceId_externalId_key" ON "CardSourceMapping"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "CardCatalogCandidate_status_materialConflict_createdAt_idx" ON "CardCatalogCandidate"("status", "materialConflict", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardCatalogCandidate_sourceId_sourceIdentity_key" ON "CardCatalogCandidate"("sourceId", "sourceIdentity");

-- CreateIndex
CREATE INDEX "CardInsightVersion_status_createdAt_idx" ON "CardInsightVersion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardInsightVersion_productId_version_key" ON "CardInsightVersion"("productId", "version");

-- CreateIndex
CREATE INDEX "ClientCard_cardProductId_identityStatus_idx" ON "ClientCard"("cardProductId", "identityStatus");

-- AddForeignKey
ALTER TABLE "ClientCard" ADD CONSTRAINT "ClientCard_cardProductId_fkey" FOREIGN KEY ("cardProductId") REFERENCES "CardProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProduct" ADD CONSTRAINT "CardProduct_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "CardIssuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProduct" ADD CONSTRAINT "CardProduct_currentOfferVersionId_fkey" FOREIGN KEY ("currentOfferVersionId") REFERENCES "CardOfferVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardProduct" ADD CONSTRAINT "CardProduct_currentInsightVersionId_fkey" FOREIGN KEY ("currentInsightVersionId") REFERENCES "CardInsightVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardOfferVersion" ADD CONSTRAINT "CardOfferVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCardIdentityLink" ADD CONSTRAINT "ClientCardIdentityLink_clientCardId_fkey" FOREIGN KEY ("clientCardId") REFERENCES "ClientCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCardIdentityLink" ADD CONSTRAINT "ClientCardIdentityLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCardWishlist" ADD CONSTRAINT "ClientCardWishlist_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCardWishlist" ADD CONSTRAINT "ClientCardWishlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSourceMapping" ADD CONSTRAINT "CardSourceMapping_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CardSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSourceMapping" ADD CONSTRAINT "CardSourceMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCatalogCandidate" ADD CONSTRAINT "CardCatalogCandidate_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CardSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCatalogCandidate" ADD CONSTRAINT "CardCatalogCandidate_matchedProductId_fkey" FOREIGN KEY ("matchedProductId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInsightVersion" ADD CONSTRAINT "CardInsightVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CardProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInsightVersion" ADD CONSTRAINT "CardInsightVersion_offerVersionId_fkey" FOREIGN KEY ("offerVersionId") REFERENCES "CardOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
