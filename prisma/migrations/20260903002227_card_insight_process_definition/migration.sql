-- AlterTable
ALTER TABLE "CardInsightVersion" ADD COLUMN     "processDefinitionId" UUID;

-- AddForeignKey
ALTER TABLE "CardInsightVersion" ADD CONSTRAINT "CardInsightVersion_processDefinitionId_fkey" FOREIGN KEY ("processDefinitionId") REFERENCES "AIProcessDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
