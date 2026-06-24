ALTER TABLE "Agent"
ADD COLUMN "agentAnalysis" JSONB,
ADD COLUMN "agentAnalysisGeneratedAt" TIMESTAMP(3),
ADD COLUMN "agentAnalysisInputHash" TEXT;
