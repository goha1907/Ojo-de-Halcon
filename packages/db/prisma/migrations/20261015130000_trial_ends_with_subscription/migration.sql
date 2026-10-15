-- Buying a subscription ends the trial place: the trials of accounts that already have a running
-- subscription are closed (their case now sits on a paid place).
UPDATE "FreeGrant"
SET "revokedAt" = now(), "expiryHandledAt" = now()
WHERE "kind" = 'TRIAL' AND "revokedAt" IS NULL
  AND "userId" IN (SELECT "id" FROM "User" WHERE "subscriptionUntil" > now());
