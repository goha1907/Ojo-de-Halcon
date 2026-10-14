"use client";

import { Button, Card } from "@ojo/ui";
import { useT } from "@/components/providers/i18n-provider";

/** Placeholder: the WhatsApp bot is being prepared. */
export function WhatsappCard() {
  const t = useT();
  return (
    <Card id="whatsapp" title={t("settings.whatsapp.title")} description={t("settings.whatsapp.help")}>
      <Button variant="secondary" disabled>
        {t("settings.whatsapp.soon")}
      </Button>
    </Card>
  );
}
