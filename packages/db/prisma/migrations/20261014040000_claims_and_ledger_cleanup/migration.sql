-- AlterTable
ALTER TABLE "TelegramOutbox" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrackerEvent" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrialLedger" DROP COLUMN "ownerHash";

