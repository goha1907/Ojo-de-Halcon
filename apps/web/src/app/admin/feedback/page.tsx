import Link from "next/link";
import { dateTime, pageParam } from "@/components/admin/format";
import { FeedbackStatus } from "@/components/admin/feedback-status";
import { Badge, PageTitle, Pager, Panel } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

const FILTERS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "READ", label: "Read" },
  { value: "ANSWERED", label: "Answered" },
  { value: "SPAM", label: "Spam" },
];

export default async function AdminFeedbackPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireStaff("feedback.manage");
  const { status, page } = await searchParams;
  const result = await getCore().admin.listFeedback({ ...(status ? { status } : {}), page: pageParam(page) });
  const href = (n: number) => `/admin/feedback?${new URLSearchParams({ ...(status ? { status } : {}), page: String(n) })}`;
  return (
    <>
      <PageTitle title="Inbox" />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/admin/feedback?status=${filter.value}` : "/admin/feedback"}
            className={`rounded-field border px-3 py-1 text-sm ${(status ?? "") === filter.value ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface hover:bg-line/40"}`}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      <div className="space-y-3">
        {result.items.map((message) => (
          <Panel key={message.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-medium text-fg">{message.name ?? "(no name)"}</span>{" "}
                <a href={`mailto:${message.email}`} className="text-fg-muted hover:underline">{message.email}</a>{" "}
                <Badge>{message.topic}</Badge> <Badge tone="blue">{message.locale}</Badge>
                {message.userId && (
                  <Link href={`/admin/users/${message.userId}`} className="ml-2 text-xs text-fg-muted underline">account</Link>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-fg-muted">
                {dateTime(message.createdAt)}
                <FeedbackStatus id={message.id} status={message.status} />
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{message.message}</p>
          </Panel>
        ))}
        {result.items.length === 0 && <p className="text-sm text-fg-muted">No messages.</p>}
      </div>
      <Pager page={result.page} pageSize={result.pageSize} total={result.total} href={href} />
    </>
  );
}
