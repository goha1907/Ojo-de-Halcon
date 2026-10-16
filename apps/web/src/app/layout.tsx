import type { Metadata } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/components/providers/i18n-provider";
import { getT } from "@/server/i18n";
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
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
