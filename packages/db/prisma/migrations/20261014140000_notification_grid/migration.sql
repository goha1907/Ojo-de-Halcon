-- Notifications are chosen per case and channel instead of per service.
ALTER TABLE "Tracker" ADD COLUMN "notifyTelegram" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false;

-- Keep what users had switched off: a service that was off silences its cases,
-- and so do relatives that were muted.
UPDATE "Tracker" t SET "notifyTelegram" = false
FROM "ServicePreference" p
WHERE p."userId" = t."userId" AND p."enabled" = false
  AND p."serviceKey" = CASE t."kind"
    WHEN 'RENAPER' THEN 'dni_production'
    WHEN 'CORREO' THEN 'dni_post'
    WHEN 'PJN' THEN 'citizenship_court'
  END;

UPDATE "Tracker" t SET "notifyTelegram" = false
FROM "Person" pe
WHERE pe."id" = t."personId" AND pe."notifyTelegram" = false;

DROP TABLE "ServicePreference";
