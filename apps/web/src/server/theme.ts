import { APP_CONFIG } from "@ojo/shared";
import { cookies } from "next/headers";
import { parseTheme, type ThemeChoice } from "@/lib/theme";

export async function getTheme(): Promise<ThemeChoice> {
  return parseTheme((await cookies()).get(APP_CONFIG.cookies.theme)?.value);
}
