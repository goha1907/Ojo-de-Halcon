import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/server/session";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect(ROUTES.dashboard);
  return <RegisterForm />;
}
