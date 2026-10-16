import { LINK_GROUPS, USEFUL_LINKS, type MessageKey } from "@ojo/shared";
import { Card } from "@ojo/ui";
import { getEnv } from "@/server/env";
import { getT } from "@/server/i18n";

const OPEN_LINK_CLASS =
  "shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-fg hover:bg-line/40";

export default async function LinksPage() {
  const { t } = await getT();
  const botUsername = getEnv().TELEGRAM_BOT_USERNAME;

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-fg">{t("links.title")}</h1>
        <p className="text-sm text-fg-muted">{t("links.subtitle")}</p>
      </header>

      {botUsername && (
        <Card title={t("links.bot.title")} description={t("links.bot.text")}>
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className={OPEN_LINK_CLASS}
          >
            {t("links.bot.open")} · @{botUsername}
          </a>
        </Card>
      )}

      {LINK_GROUPS.map((group) => (
        <Card key={group} title={t(`links.group.${group}` as MessageKey)}>
          <ul className="divide-y divide-line">
            {USEFUL_LINKS.filter((link) => link.group === group).map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm text-fg">{t(`links.item.${link.id}` as MessageKey)}</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={OPEN_LINK_CLASS}>
                  {t("links.open")}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
