-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Run_workflowId_idempotencyKey_key" ON "Run"("workflowId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_workflowId_version_fkey" FOREIGN KEY ("workflowId", "version") REFERENCES "Version"("workflowId", "number") ON DELETE RESTRICT ON UPDATE CASCADE;

