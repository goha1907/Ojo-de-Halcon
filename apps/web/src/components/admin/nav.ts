import type { AdminPermission } from "@ojo/shared";

/** Admin menu. The labels are English on purpose: the admin area is English-only. */
export const ADMIN_NAV: { href: string; label: string; permission: AdminPermission }[] = [
  { href: "/admin", label: "Overview", permission: "overview.read" },
  { href: "/admin/users", label: "Users", permission: "users.read" },
  { href: "/admin/feedback", label: "Inbox", permission: "feedback.manage" },
  { href: "/admin/news", label: "News", permission: "news.manage" },
  { href: "/admin/sources", label: "Sources", permission: "sources.read" },
  { href: "/admin/statuses", label: "Statuses", permission: "stats.read" },
  { href: "/admin/economics", label: "Economics", permission: "economics.read" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read" },
];
