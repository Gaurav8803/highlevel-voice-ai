-- AlterTable
ALTER TABLE "CallEvaluation"
ADD COLUMN "callPath" TEXT,
ADD COLUMN "outOfScopeItems" JSONB NOT NULL DEFAULT '[]';
