import { Alert, Card } from "@ojo/ui";
import { VerifyEmailAction } from "@/components/auth/verify-email-action";
import { getT } from "@/server/i18n";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { t } = await getT();
  if (!token) {
    return (
      <Card title={t("auth.verify.pendingTitle")}>
        <Alert tone="error">{t("auth.verify.invalid")}</Alert>
      </Card>
    );
  }
  return <VerifyEmailAction token={token} />;
}
