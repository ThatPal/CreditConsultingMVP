ALTER TABLE "ServiceProduct"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ServiceProductVersion"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
