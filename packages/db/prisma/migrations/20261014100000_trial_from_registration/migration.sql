-- The trial now runs from account creation: fill it for accounts that never tracked anything.
UPDATE "User" SET "trialStartedAt" = "createdAt" WHERE "trialStartedAt" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "trialStartedAt" SET NOT NULL,
ALTER COLUMN "trialStartedAt" SET DEFAULT CURRENT_TIMESTAMP;
