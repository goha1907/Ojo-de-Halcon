import { APP_CONFIG, createTranslator, resolveLocale, type Locale, type TranslateFn } from "@ojo/shared";
import { cookies, headers } from "next/headers";

/** Locale priority: explicit cookie → Accept-Language → default. */
export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(APP_CONFIG.cookies.locale)?.value;
  if (stored) return resolveLocale(stored);
  const accept = (await headers()).get("accept-language");
  return resolveLocale(accept);
}

export async function getT(): Promise<{ locale: Locale; t: TranslateFn }> {
  const locale = await getLocale();
  return { locale, t: createTranslator(locale) };
}
