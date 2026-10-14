-- AlterTable
ALTER TABLE "TelegramOutbox" ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "initialNotified" BOOLEAN NOT NULL DEFAULT false;


-- Cases that already existed were reported before this column appeared.
UPDATE "Tracker" SET "initialNotified" = true;
