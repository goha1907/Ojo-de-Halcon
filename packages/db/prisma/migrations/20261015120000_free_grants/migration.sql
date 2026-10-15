-- CreateTable
CREATE TABLE "FreeGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cases" INTEGER NOT NULL,
    "note" TEXT,
    "grantedBy" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiryHandledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeGrant_userId_idx" ON "FreeGrant"("userId");

-- CreateIndex
CREATE INDEX "FreeGrant_expiresAt_expiryHandledAt_idx" ON "FreeGrant"("expiresAt", "expiryHandledAt");

-- AddForeignKey
ALTER TABLE "FreeGrant" ADD CONSTRAINT "FreeGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The trial of every existing account becomes a grant with an explicit end date (7 days from its start).
-- A trial that is already over counts as handled: nobody is notified about it afterwards.
INSERT INTO "FreeGrant" ("id", "userId", "kind", "cases", "grantedBy", "startsAt", "expiresAt", "expiryHandledAt")
SELECT gen_random_uuid()::text, "id", 'TRIAL', 1, 'system', "trialStartedAt", "trialStartedAt" + interval '7 days',
       CASE WHEN "trialStartedAt" + interval '7 days' <= now() THEN now() ELSE NULL END
FROM "User";
