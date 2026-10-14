-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "slotSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;


-- existing cases hold their slot since they were created
UPDATE "Tracker" SET "slotSince" = "createdAt";
