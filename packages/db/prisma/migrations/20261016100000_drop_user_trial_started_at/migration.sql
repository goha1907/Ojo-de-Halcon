-- The trial is a free grant with its own start and end dates; the account no longer carries a trial start.
-- (The mailbox registry "TrialLedger" keeps the start date of a used trial.)
ALTER TABLE "User" DROP COLUMN "trialStartedAt";
