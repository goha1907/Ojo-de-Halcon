"use client";

import { API_ROUTES, SETTINGS_SECTIONS, TRACKER_KIND_SECTION, SERVICE_GROUPS, settingsHref, type MessageKey, type TrackerKindValue } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

export interface NotificationCase {
  id: string;
  kind: TrackerKindValue;
  reference: string;
  label: string | null;
  /** Relative the case belongs to; null = the account owner. */
  person: string | null;
  telegram: boolean;
  whatsapp: boolean;
}

const SECTION_ORDER: string[] = SERVICE_GROUPS.flatMap((group) => group.items.map((item) => item.section as string));

/** Grid "case x channel": every case a user tracks, grouped by section, with its own switches. */
export function NotificationsCard({ cases, telegramLinked }: { cases: NotificationCase[]; telegramLinked: boolean }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function setTelegram(id: string, telegram: boolean) {
    setBusy(id);
    setError("");
    try {
      await apiRequest(`${API_ROUTES.trackers}/${id}/notify`, { method: "PUT", body: { telegram } });
      router.refresh();
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(null);
    }
  }

  const sections = [...new Set(cases.map((item) => TRACKER_KIND_SECTION[item.kind] as string))].sort(
    (a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b),
  );

  return (
    <Card id={SETTINGS_SECTIONS.notifications} title={t("settings.notifications.title")} description={t("settings.notifications.help")}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {!telegramLinked && (
          <Alert tone="info">
            {t("settings.notifications.notLinked")}{" "}
            <Link href={settingsHref("telegram")} className="font-medium underline">
              {t("settings.notifications.openProfile")}
            </Link>
          </Alert>
        )}
        {cases.length === 0 ? (
          <p className="text-sm text-slate-500">{t("settings.notifications.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-semibold">{t("settings.notifications.case")}</th>
                  <th className="w-28 px-2 py-2 text-center font-semibold">{t("settings.notifications.telegram")}</th>
                  <th className="w-28 px-2 py-2 text-center font-semibold">{t("settings.notifications.whatsapp")}</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <SectionRows
                    key={section}
                    title={t(`sections.${section}` as MessageKey)}
                    rows={cases.filter((item) => TRACKER_KIND_SECTION[item.kind] === section)}
                    busy={busy}
                    onTelegram={setTelegram}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function SectionRows({
  title,
  rows,
  busy,
  onTelegram,
}: {
  title: string;
  rows: NotificationCase[];
  busy: string | null;
  onTelegram: (id: string, value: boolean) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  return (
    <>
      <tr>
        <th colSpan={3} className="bg-slate-50 p-0 text-left">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
          >
            <span aria-hidden="true" className={`text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
            {title}
            <span className="font-normal normal-case text-slate-400">({rows.length})</span>
          </button>
        </th>
      </tr>
      {open && rows.map((item) => (
        <tr key={item.id} className="border-b border-slate-100">
          <td className="py-2.5 pr-4">
            <div className="font-medium text-slate-900">{item.label ?? `№ ${item.reference}`}</div>
            <div className="text-xs text-slate-500">
              {item.label ? `№ ${item.reference}` : ""}
              {item.person ? `${item.label ? " · " : ""}${item.person}` : ""}
            </div>
          </td>
          <td className="px-2 text-center">
            <input
              type="checkbox"
              checked={item.telegram}
              disabled={busy === item.id}
              aria-label={`${t("settings.notifications.telegram")}: ${item.label ?? item.reference}`}
              onChange={(event) => onTelegram(item.id, event.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
          </td>
          <td className="px-2 text-center">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <input type="checkbox" disabled checked={item.whatsapp} readOnly className="h-4 w-4" />
              {t("settings.notifications.soon")}
            </label>
          </td>
        </tr>
      ))}
    </>
  );
}
