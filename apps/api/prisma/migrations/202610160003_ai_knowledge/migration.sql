-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "actorId" UUID;

-- CreateTable
CREATE TABLE "ModelEndpoint" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiStyle" TEXT NOT NULL DEFAULT 'chat-completions',
    "chatModel" TEXT,
    "embeddingModel" TEXT,
    "dimensions" INTEGER,
    "credentialEnv" TEXT,
    "health" TEXT NOT NULL DEFAULT 'UNTESTED',
    "lastError" TEXT,
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "knowledgeBaseId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "embedding" vector NOT NULL,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "runId" UUID,
    "nodeId" UUID,
    "documentId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "token" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelEndpoint_workspaceId_createdAt_idx" ON "ModelEndpoint"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelEndpoint_id_workspaceId_key" ON "ModelEndpoint"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_workspaceId_createdAt_idx" ON "KnowledgeBase"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBase_id_workspaceId_key" ON "KnowledgeBase"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Document_knowledgeBaseId_status_idx" ON "Document"("knowledgeBaseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_knowledgeBaseId_contentHash_key" ON "Document"("knowledgeBaseId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_ordinal_key" ON "DocumentChunk"("documentId", "ordinal");

-- CreateIndex
CREATE INDEX "AiJob_status_leaseUntil_idx" ON "AiJob"("status", "leaseUntil");

-- CreateIndex
CREATE INDEX "AiJob_runId_idx" ON "AiJob"("runId");

-- CreateIndex
CREATE INDEX "AiJob_documentId_idx" ON "AiJob"("documentId");

-- AddForeignKey
ALTER TABLE "ModelEndpoint" ADD CONSTRAINT "ModelEndpoint_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_endpointId_workspaceId_fkey" FOREIGN KEY ("endpointId", "workspaceId") REFERENCES "ModelEndpoint"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_knowledgeBaseId_workspaceId_fkey" FOREIGN KEY ("knowledgeBaseId", "workspaceId") REFERENCES "KnowledgeBase"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiJob" ADD CONSTRAINT "AiJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

