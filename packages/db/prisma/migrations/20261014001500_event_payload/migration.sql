-- AlterTable
ALTER TABLE "TrackerEvent" DROP COLUMN "text",
ADD COLUMN     "payload" JSONB NOT NULL;

