-- Cancelling the subscription is a flag on the subscription, not a mark on every case.
ALTER TABLE "Tracker" DROP COLUMN "cancelledWithSubscription";
ALTER TABLE "User" ADD COLUMN "subscriptionCancelledAt" TIMESTAMP(3);
