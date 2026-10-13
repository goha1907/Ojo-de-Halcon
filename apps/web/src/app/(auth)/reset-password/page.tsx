import { Alert, Card } from "@ojo/ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getT } from "@/server/i18n";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { t } = await getT();
  if (!token) {
    return (
      <Card title={t("auth.reset.title")}>
        <Alert tone="error">{t("auth.reset.invalid")}</Alert>
      </Card>
    );
  }
  return <ResetPasswordForm token={token} />;
}
