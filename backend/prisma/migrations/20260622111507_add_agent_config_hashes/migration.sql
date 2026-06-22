-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "configHash" TEXT,
ADD COLUMN     "rubricConfigHash" TEXT,
ADD COLUMN     "welcomeMessage" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
