-- A finished case is neither polled nor notified.
UPDATE "Tracker" SET "notifyTelegram" = false, "notifyWhatsapp" = false WHERE "status" = 'FINISHED';
