import type { Metadata } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { getT } from "@/server/i18n";
import { getTheme } from "@/server/theme";
import "@fontsource-variable/inter";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: t("app.name"),
    description: t("app.tagline"),
    icons: {
      icon: [
        { url: "/brand/favicon.svg", type: "image/svg+xml" },
        { url: "/brand/favicon.ico", sizes: "48x48" },
      ],
      apple: "/images/brand/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getT();
  const theme = await getTheme();
  return (
    // the head script sets data-theme for visitors who follow the system, so the attribute may differ from the server's
    <html lang={locale} data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
