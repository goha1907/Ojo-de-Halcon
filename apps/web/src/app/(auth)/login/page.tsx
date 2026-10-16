import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/route-guard";
import { getCurrentUser } from "@/server/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  // Already signed in (really, not just a leftover cookie): go where they wanted, or to the app.
  if (await getCurrentUser()) redirect(next ?? ROUTES.dashboard);
  return <LoginForm next={next} />;
}
