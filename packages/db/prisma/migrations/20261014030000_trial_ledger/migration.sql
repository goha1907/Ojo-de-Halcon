-- AlterTable (nullable first: existing rows are backfilled below)
ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT;

UPDATE "User"
SET "emailCanonical" = CASE
  WHEN split_part(lower("email"), '@', 2) IN ('gmail.com', 'googlemail.com')
    THEN replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '') || '@gmail.com'
  ELSE split_part(split_part(lower("email"), '@', 1), '+', 1) || '@' || split_part(lower("email"), '@', 2)
END;

ALTER TABLE "User" ALTER COLUMN "emailCanonical" SET NOT NULL;

-- CreateTable
CREATE TABLE "TrialLedger" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerHash" TEXT,
    "trialStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialLedger_keyHash_key" ON "TrialLedger"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");
