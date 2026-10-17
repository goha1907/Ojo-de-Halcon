import { LOCALES, type Locale } from "@ojo/shared";
import Link from "next/link";
import { NewsEditor } from "@/components/admin/news-editor";
import { PageTitle, Panel } from "@/components/admin/ui";
import { requireStaff } from "@/server/session";

const EMPTY = Object.fromEntries(LOCALES.map((locale) => [locale, { title: "", summary: "", body: "" }])) as Record<Locale, { title: string; summary: string; body: string }>;

export default async function NewNewsPage() {
  await requireStaff("news.manage");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Link href="/admin/news" className="mb-3 inline-block text-sm text-fg-muted hover:underline">
        ← Back to news
      </Link>
      <PageTitle title="New news entry" />
      <Panel>
        <NewsEditor slug={null} date={today} time="" texts={EMPTY} />
      </Panel>
    </>
  );
}
