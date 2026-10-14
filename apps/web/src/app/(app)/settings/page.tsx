import { ROUTES } from "@ojo/shared";
import { redirect } from "next/navigation";

/** The old single settings page: its cards now live on three pages. */
export default function SettingsIndexPage() {
  redirect(ROUTES.settingsProfile);
}
