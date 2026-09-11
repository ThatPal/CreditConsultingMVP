CREATE TABLE "PlanResponseDraft" (
 "id" UUID NOT NULL PRIMARY KEY,
 "itemId" UUID NOT NULL REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "actorId" UUID NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "values" JSONB NOT NULL,
 "note" TEXT NOT NULL,
 "help" BOOLEAN NOT NULL,
 "documentIds" UUID[] NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "PlanResponseDraft_itemId_actorId_key" ON "PlanResponseDraft"("itemId", "actorId");
