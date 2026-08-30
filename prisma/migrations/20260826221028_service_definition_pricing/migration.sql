-- CreateTable
CREATE TABLE "ServiceDefinition" (
    "serviceType" "ServiceType" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDefinition_pkey" PRIMARY KEY ("serviceType")
);

INSERT INTO "ServiceDefinition" ("serviceType", "price", "currency", "active", "updatedAt")
VALUES ('CREDIT_PROFILE_REVIEW', 149.00, 'USD', true, CURRENT_TIMESTAMP);
