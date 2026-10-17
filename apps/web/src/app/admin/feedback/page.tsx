import Link from "next/link";
import { dateTime, pageParam } from "@/components/admin/format";
import { FeedbackStatus } from "@/components/admin/feedback-status";
import { FilterBar, SortLinks, flatParams, listHref } from "@/components/admin/list-controls";
import { Badge, PageTitle, Pager, Panel } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

const BASE = "/admin/feedback";
const TOPICS = ["tracking", "technical", "subscription", "suggestion", "partnership", "other"];

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff("feedback.manage");
  const params = flatParams(await searchParams);
  const result = await getCore().admin.listFeedback({
    page: pageParam(params.page),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { query: params.q } : {}),
    ...(params.topic ? { topic: params.topic } : {}),
    ...(params.locale ? { locale: params.locale } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.dir === "asc" || params.dir === "desc" ? { dir: params.dir } : {}),
  });
  return (
    <>
      <PageTitle title="Inbox" />
      <FilterBar
        base={BASE}
        params={params}
        fields={[
          { name: "q", label: "Text, name or e-mail", kind: "text", placeholder: "Search…" },
          { name: "status", label: "Status", kind: "select", options: ["NEW", "READ", "ANSWERED", "SPAM"].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() })) },
          { name: "topic", label: "Topic", kind: "select", options: TOPICS.map((value) => ({ value, label: value })) },
          { name: "locale", label: "Language", kind: "select", options: ["ru", "es", "en"].map((value) => ({ value, label: value })) },
          { name: "from", label: "From", kind: "date" },
          { name: "to", label: "To", kind: "date" },
        ]}
      />
      <SortLinks
        base={BASE}
        params={params}
        defaultSort="createdAt"
        options={[{ field: "createdAt", label: "Date" }, { field: "status", label: "Status" }, { field: "topic", label: "Topic" }, { field: "email", label: "E-mail" }]}
      />
      <div className="space-y-3">
        {result.items.map((message) => (
          <Panel key={message.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium text-fg">{message.name ?? "(no name)"}</span>{" "}
                <a href={`mailto:${message.email}`} className="text-fg-muted hover:underline">{message.email}</a>{" "}
                <Badge>{message.topic}</Badge> <Badge tone="blue">{message.locale}</Badge>
                {message.replied && <> <Badge tone="green">replied</Badge></>}
                {message.userId && (
                  <Link href={`/admin/users/${message.userId}`} className="ml-2 text-xs text-fg-muted underline">account</Link>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-fg-muted">
                {dateTime(message.createdAt)}
                <FeedbackStatus id={message.id} status={message.status} />
              </div>
            </div>
            <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-fg">{message.message}</p>
            <Link href={`/admin/feedback/${message.id}`} className="mt-2 inline-block text-sm text-brand hover:underline">
              Open and answer
            </Link>
          </Panel>
        ))}
        {result.items.length === 0 && <p className="text-sm text-fg-muted">No messages.</p>}
      </div>
      <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={(n) => listHref(BASE, params, { page: String(n) })} />
    </>
  );
}
