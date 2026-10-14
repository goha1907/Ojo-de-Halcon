-- Relatives are gone: every case belongs to the account owner (a holder's birth date
-- is stored per case instead).
DROP INDEX IF EXISTS "Tracker_userId_personKey_kind_reference_key";
ALTER TABLE "Tracker" DROP CONSTRAINT IF EXISTS "Tracker_personId_fkey";
ALTER TABLE "Tracker" DROP COLUMN "personId", DROP COLUMN "personKey";
CREATE UNIQUE INDEX "Tracker_userId_kind_reference_key" ON "Tracker"("userId", "kind", "reference");
DROP TABLE "Person";
