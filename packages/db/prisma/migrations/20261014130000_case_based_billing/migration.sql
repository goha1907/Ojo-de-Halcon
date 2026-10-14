-- Subscription is priced per tracked case: slots per section ("packs") and relative seats go away.
ALTER TABLE "User" ADD COLUMN "paidCases" INTEGER NOT NULL DEFAULT 0;

-- Existing subscribers keep what they had: the old packs, but never fewer than the cases they track.
UPDATE "User" u SET "paidCases" = GREATEST(
  1 + u."seats",
  (SELECT COUNT(*) FROM "Tracker" t
    WHERE t."userId" = u."id" AND t."status" IN ('ACTIVE', 'PENDING_CONFIRMATION'))
)
WHERE u."subscriptionUntil" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "seats", DROP COLUMN "nextPacks";

ALTER TABLE "Payment" RENAME COLUMN "seatsDelta" TO "casesDelta";
UPDATE "Payment" SET "kind" = 'cases' WHERE "kind" = 'seats';
