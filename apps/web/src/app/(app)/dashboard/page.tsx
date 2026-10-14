import { settingsHref } from "@ojo/shared";
import { Alert, Card } from "@ojo/ui";
import Link from "next/link";
import { getT } from "@/server/i18n";
import { requireUser } from "@/server/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const { t } = await getT();
  const link = "font-medium underline";

  return (
    <>
      {!user.profileComplete && (
        <Alert tone="info">
          {t("dashboard.profileNudge")}{" "}
          <Link href={settingsHref("profile")} className={link}>
            {t("dashboard.profileLink")}
          </Link>
        </Alert>
      )}
      {!user.telegramLinked && (
        <Alert tone="info">
          {t("dashboard.telegramNudge")}{" "}
          <Link href={settingsHref("telegram")} className={link}>
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
    </>
  );
}
