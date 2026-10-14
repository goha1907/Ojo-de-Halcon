import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/server/session";

export default async function LoginPage() {
  // Already signed in (really, not just a leftover cookie): go to the app.
  if (await getCurrentUser()) redirect(ROUTES.dashboard);
  return <LoginForm />;
}
