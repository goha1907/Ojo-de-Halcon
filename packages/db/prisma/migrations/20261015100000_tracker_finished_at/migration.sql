-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN "finishedAt" TIMESTAMP(3);

-- Best effort for cases that were already finished: the last change of the row.
UPDATE "Tracker" SET "finishedAt" = "updatedAt" WHERE "status" = 'FINISHED';
