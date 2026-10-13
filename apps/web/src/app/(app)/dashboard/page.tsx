import { ROUTES } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { getT } from "@/server/i18n";
import { listNews } from "@/server/news";
import { requireUser } from "@/server/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const { t, locale } = await getT();
  const latest = (await listNews(locale)).slice(0, 3);
  const link = "font-medium underline";

  return (
    <>
      {!user.profileComplete && (
        <Alert tone="info">
          {t("dashboard.profileNudge")}{" "}
          <Link href={ROUTES.settings} className={link}>
            {t("dashboard.profileLink")}
          </Link>
        </Alert>
      )}
      {!user.telegramLinked && (
        <Alert tone="info">
          {t("dashboard.telegramNudge")}{" "}
          <Link href={ROUTES.settings} className={link}>
            {t("dashboard.telegramLink")}
          </Link>
        </Alert>
      )}
      <Card
        title={user.firstName ? t("dashboard.welcome", { name: user.firstName }) : t("dashboard.welcomeAnon")}
        description={t("dashboard.stub")}
      >
        <p className="text-sm text-slate-500">{t("dashboard.title")}</p>
      </Card>
      {latest.length > 0 && (
        <Card title={t("news.latest")}>
          <ul className="space-y-3">
            {latest.map((item) => (
              <li key={item.slug}>
                <Link href={`${ROUTES.news}/${item.slug}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {item.title}
                </Link>
                <p className="text-xs text-slate-500">{item.date}</p>
              </li>
            ))}
          </ul>
          <Link href={ROUTES.news} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
            {t("news.all")}
          </Link>
        </Card>
      )}
    </>
  );
}
