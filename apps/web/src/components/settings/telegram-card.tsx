"use client";

import { API_ROUTES, APP_CONFIG, SETTINGS_SECTIONS, type MessageKey } from "@ojo/shared";
import { Alert, Button, Card, Spinner } from "@ojo/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { describeApiError } from "@/lib/api-errors";

interface LinkInfo {
  code: string;
  deepLink: string;
  expiresAt: string;
}

const minutesUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000);

export function TelegramCard({ linked, username }: { linked: boolean; username: string | null }) {
  const t = useT();
  const router = useRouter();
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState(0);

  // While the code is shown, ask the server whether the bot bound the account.
  useEffect(() => {
    if (!link || linked) return;
    const timer = setInterval(async () => {
      if (new Date(link.expiresAt).getTime() <= Date.now()) {
        setExpired(true);
        setLink(null);
        return;
      }
      setMinutesLeft(minutesUntil(link.expiresAt));
      try {
        const status = await apiRequest<{ linked: boolean }>(API_ROUTES.telegramLink);
        if (status.linked) {
          setLink(null);
          router.refresh();
        }
      } catch {
        // transient error: keep polling
      }
    }, APP_CONFIG.auth.linkPollIntervalMs);
    return () => clearInterval(timer);
  }, [link, linked, router]);

  async function connect() {
    setBusy(true);
    setError(null);
    setExpired(false);
    try {
      const info = await apiRequest<LinkInfo>(API_ROUTES.telegramLink, { method: "POST" });
      setLink(info);
      setMinutesLeft(minutesUntil(info.expiresAt));
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await apiRequest(API_ROUTES.telegram, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError(describeApiError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!link) return;
    await navigator.clipboard.writeText(link.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card id={SETTINGS_SECTIONS.telegram} title={t("settings.telegram.title")} description={t("settings.telegram.help")}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}

        {linked ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-emerald-700">{t("settings.telegram.linked")}</span>
              {" · "}
              {t("settings.telegram.account", {
                username: username ? `@${username}` : t("settings.telegram.noUsername"),
              })}
            </p>
            <Button variant="secondary" loading={busy} onClick={unlink}>
              {t("settings.telegram.unlink")}
            </Button>
          </div>
        ) : link ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{t("settings.telegram.instruction")}</p>
            <a
              href={link.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("settings.telegram.openBot")}
            </a>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t("settings.telegram.orCode")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm break-all">{link.code}</code>
                <Button variant="secondary" onClick={copyCode}>
                  {copied ? t("common.copied") : t("common.copy")}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" />
                {t("settings.telegram.waiting")}
              </span>
              <span>{t("settings.telegram.expiresIn", { minutes: Math.max(minutesLeft, 1) })}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {expired && <Alert tone="error">{t("settings.telegram.expired")}</Alert>}
            <p className="text-sm text-slate-600">{t("settings.telegram.notLinked")}</p>
            <Button loading={busy} onClick={connect}>
              {t("settings.telegram.connect")}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Translates a failure code coming back from the bot flow (used by future flows). */
export function telegramFailureKey(reason: string): MessageKey {
  return `settings.telegram.failure.${reason}` as MessageKey;
}
