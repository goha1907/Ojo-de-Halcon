-- AlterEnum
ALTER TYPE "TrackerKind" ADD VALUE 'OCASA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "earlyAccess" BOOLEAN NOT NULL DEFAULT false;
