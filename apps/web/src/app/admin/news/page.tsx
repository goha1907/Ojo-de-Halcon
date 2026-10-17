import { LOCALES } from "@ojo/shared";
import Link from "next/link";
import { pageParam } from "@/components/admin/format";
import { FilterBar, SortTh, flatParams, listHref } from "@/components/admin/list-controls";
import { sortAndPage } from "@/components/admin/memory-list";
import { Badge, PageTitle, Pager, Panel, TABLE, TD, TH } from "@/components/admin/ui";
import { DeleteNews } from "@/components/admin/delete-news";
import { getCore } from "@/server/core";
import { readFiles } from "@/server/news";
import { requireStaff } from "@/server/session";

const BASE = "/admin/news";

export default async function AdminNewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("news.manage");
  const params = flatParams(await searchParams);
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
  const needle = (params.q ?? "").trim().toLowerCase();
  const all = [
    ...written.map((entry) => ({
      slug: entry.slug,
      date: entry.date,
      time: entry.time,
      title: entry.translations.ru?.title ?? entry.slug,
      locales: Object.keys(entry.translations),
      fromFile: false,
    })),
    ...[...fileEntries.values()].map((entry) => ({ ...entry, fromFile: true })),
  ].filter(
    (row) =>
      (!needle || row.title.toLowerCase().includes(needle) || row.slug.includes(needle)) &&
      (!params.source || (params.source === "file") === row.fromFile) &&
      (!params.locale || row.locales.includes(params.locale)),
  );
  const page = sortAndPage(
    all,
    { sort: params.sort, dir: params.dir, page: pageParam(params.page), pageSize: 20 },
    { date: (row) => `${row.date} ${row.time}`, title: (row) => row.title, source: (row) => (row.fromFile ? "file" : "admin"), languages: (row) => row.locales.length },
    { sort: "date", dir: "desc" },
  );
  const sort = (label: string, field: string) => (
    <SortTh label={label} field={field} base={BASE} params={params} defaultSort="date" defaultDir={field === "date" ? "desc" : "asc"} />
  );

  return (
    <>
      <PageTitle title="News">
        <Link href="/admin/news/new" className="rounded-field bg-brand px-4 py-2 text-sm font-medium text-brand-fg hover:bg-brand-hover">
          New entry
        </Link>
      </PageTitle>
      <FilterBar
        base={BASE}
        params={params}
        fields={[
          { name: "q", label: "Title or link contains", kind: "text", placeholder: "Search…" },
          { name: "locale", label: "Has language", kind: "select", options: LOCALES.map((value) => ({ value, label: value })) },
          { name: "source", label: "Source", kind: "select", options: [{ value: "admin", label: "Written here" }, { value: "file", label: "File" }] },
        ]}
      />
      <Panel note="Entries published here appear on the landing page at once. Entries marked “file” are kept in the repository: editing one publishes a replacement.">
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                {sort("Date", "date")}
                {sort("Title", "title")}
                {sort("Languages", "languages")}
                {sort("Source", "source")}
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {page.items.map((row) => (
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
        <Pager page={page.page} pageSize={page.pageSize} total={page.total} href={(n) => listHref(BASE, params, { page: String(n) })} />
      </Panel>
    </>
  );
}
