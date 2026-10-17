import Link from "next/link";
import { notFound } from "next/navigation";
import { FeedbackReply } from "@/components/admin/feedback-reply";
import { FeedbackStatus } from "@/components/admin/feedback-status";
import { dateTime } from "@/components/admin/format";
import { Badge, PageTitle, Panel } from "@/components/admin/ui";
import { getCore } from "@/server/core";
import { requireStaff } from "@/server/session";

export default async function AdminFeedbackMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("feedback.manage");
  const { id } = await params;
  // opening a new message marks it as read
  const message = await getCore().admin.openFeedback({ id: staff.id, email: staff.email }, id);
  if (!message) notFound();
  return (
    <>
      <Link href="/admin/feedback" className="mb-3 inline-block text-sm text-fg-muted hover:underline">← Back to the inbox</Link>
      <PageTitle title={message.name ?? message.email} />
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <a href={`mailto:${message.email}`} className="text-fg-muted hover:underline">{message.email}</a>{" "}
              <Badge>{message.topic}</Badge> <Badge tone="blue">{message.locale}</Badge>
              {message.userId && <Link href={`/admin/users/${message.userId}`} className="ml-2 text-xs text-fg-muted underline">account</Link>}
            </div>
            <div className="flex items-center gap-3 text-xs text-fg-muted">
              {dateTime(message.createdAt)}
              <FeedbackStatus id={message.id} status={message.status} />
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-fg">{message.message}</p>
        </Panel>
        {message.reply && (
          <Panel title="Answer">
            <p className="whitespace-pre-wrap text-sm text-fg">{message.reply}</p>
            <p className="mt-2 text-xs text-fg-muted">{message.repliedBy} · {dateTime(message.repliedAt)} · simulated, not e-mailed</p>
          </Panel>
        )}
        <Panel title={message.reply ? "Answer again" : "Answer"}>
          <FeedbackReply id={message.id} email={message.email} />
        </Panel>
      </div>
    </>
  );
}
