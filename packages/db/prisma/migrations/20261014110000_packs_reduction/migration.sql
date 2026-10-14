-- AlterEnum
ALTER TYPE "TrackerStatus" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "keepNext" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pausedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nextPacks" INTEGER;

