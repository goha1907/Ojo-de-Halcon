import { LOCALES } from "@ojo/shared";
import Link from "next/link";
import { Badge, PageTitle, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { DeleteNews } from "@/components/admin/delete-news";
import { getCore } from "@/server/core";
import { readFiles } from "@/server/news";
import { requireStaff } from "@/server/session";

export default async function AdminNewsPage() {
  await requireStaff("news.manage");
  const [written, files] = await Promise.all([getCore().admin.listNews(), readFiles()]);
  const writtenSlugs = new Set(written.map((entry) => entry.slug));
  const fileEntries = new Map<string, { slug: string; date: string; time: string; title: string; locales: string[] }>();
  for (const item of files) {
    if (writtenSlugs.has(item.slug)) continue;
    const entry = fileEntries.get(item.slug) ?? { slug: item.slug, date: item.date, time: item.time, title: item.title, locales: [] };
    entry.locales.push(item.locale);
    if (item.locale === "ru") entry.title = item.title;
    fileEntries.set(item.slug, entry);
  }
  const rows = [
    ...written.map((entry) => ({
      slug: entry.slug,
      date: entry.date,
      time: entry.time,
      title: entry.translations.ru?.title ?? entry.slug,
      locales: Object.keys(entry.translations),
      fromFile: false,
    })),
    ...[...fileEntries.values()].map((entry) => ({ ...entry, fromFile: true })),
  ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return (
    <>
      <PageTitle title="News">
        <Link href="/admin/news/new" className="rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover">
          New entry
        </Link>
      </PageTitle>
      <Panel note="Entries published here appear on the landing page at once. Entries marked “file” are kept in the repository: editing one publishes a replacement.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Title</th>
                <th className={TH}>Languages</th>
                <th className={TH}>Source</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-t border-line">
                  <td className={TD}>{row.date} {row.time !== "00:00" ? row.time : ""}</td>
                  <td className={TD}>{row.title}</td>
                  <td className={TD}>
                    {LOCALES.map((locale) => (
                      <Badge key={locale} tone={row.locales.includes(locale) ? "green" : "slate"}>{locale}</Badge>
                    ))}
                  </td>
                  <td className={TD}>{row.fromFile ? "file" : "admin"}</td>
                  <td className={`${TD} flex gap-2`}>
                    <Link href={`/admin/news/${row.slug}`} className="rounded-field border border-line px-3 py-1 text-xs hover:bg-line/40">Edit</Link>
                    {!row.fromFile && <DeleteNews slug={row.slug} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
