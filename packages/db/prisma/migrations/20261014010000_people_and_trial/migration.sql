-- DropIndex
DROP INDEX "Tracker_userId_kind_reference_key";

-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "personId" TEXT,
ADD COLUMN     "personKey" TEXT NOT NULL DEFAULT 'self';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionUntil" TIMESTAMP(3),
ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "pjnJurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Tracker_userId_personKey_kind_reference_key" ON "Tracker"("userId", "personKey", "kind", "reference");

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Existing trackers started the trial of their owner.
UPDATE "User" u
SET "trialStartedAt" = t."firstAt"
FROM (SELECT "userId", MIN("createdAt") AS "firstAt" FROM "Tracker" GROUP BY "userId") t
WHERE t."userId" = u.id AND u."trialStartedAt" IS NULL;
