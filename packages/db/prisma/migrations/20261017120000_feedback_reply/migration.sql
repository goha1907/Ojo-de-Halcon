-- AlterTable
ALTER TABLE "FeedbackMessage" ADD COLUMN "reply" TEXT,
ADD COLUMN "repliedAt" TIMESTAMP(3),
ADD COLUMN "repliedBy" TEXT;
