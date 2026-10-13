"use client";

import { API_ROUTES } from "@ojo/shared";
import { Alert, Button, Card } from "@ojo/ui";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { ServiceCheckboxes, type ServiceValues } from "@/components/services/service-checkboxes";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

export function ServicesCard({ initial }: { initial: ServiceValues }) {
  const t = useT();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setStatus("saving");
    try {
      await apiRequest(API_ROUTES.services, { method: "PUT", body: { services: values } });
      setStatus("saved");
    } catch (e) {
      setError(describeApiError(e, t));
      setStatus("error");
    }
  }

  return (
    <Card title={t("settings.services.title")} description={t("settings.services.help")}>
      <div className="space-y-4">
        {status === "saved" && <Alert tone="success">{t("common.saved")}</Alert>}
        {status === "error" && <Alert tone="error">{error}</Alert>}
        <ServiceCheckboxes
          values={values}
          onChange={(next) => {
            setStatus("idle");
            setValues(next);
          }}
        />
        <Button onClick={save} loading={status === "saving"}>
          {t("common.save")}
        </Button>
      </div>
    </Card>
  );
}
