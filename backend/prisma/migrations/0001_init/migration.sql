-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "ghlAgentId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "agentPrompt" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "rubric" JSONB,
    "rubricGeneratedAt" TIMESTAMP(3),
    "rawConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "ghlCallId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "transcript" TEXT NOT NULL,
    "transcriptTurns" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "executedActions" JSONB NOT NULL,
    "extractedData" JSONB NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallEvaluation" (
    "id" TEXT NOT NULL,
    "callLogId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "deterministicResults" JSONB NOT NULL,
    "semanticResults" JSONB NOT NULL,
    "findings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_ghlAgentId_key" ON "Agent"("ghlAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_ghlCallId_key" ON "CallLog"("ghlCallId");

-- CreateIndex
CREATE UNIQUE INDEX "CallEvaluation_callLogId_key" ON "CallEvaluation"("callLogId");

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvaluation" ADD CONSTRAINT "CallEvaluation_callLogId_fkey" FOREIGN KEY ("callLogId") REFERENCES "CallLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallEvaluation" ADD CONSTRAINT "CallEvaluation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
