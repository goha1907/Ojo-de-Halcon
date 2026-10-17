import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, casesPrice, LOCALES, type Locale, type TrackerKindValue } from "@ojo/shared";
import type { AccessService } from "../access/access-service";
import type { BillingService } from "../billing/billing-service";
import { GRANT_KINDS, type GrantKind, type GrantService } from "../grants/grant-service";
import { createAdminLists } from "./admin-lists";
import type { TrackerService } from "../trackers/tracker-service";

/** Who is acting in the admin area (copied into the audit log). */
export interface Actor {
  id: string;
  email: string;
}

export interface OverviewDto {
  users: { total: number; newLast7Days: number; staff: number };
  subscriptions: { running: number; paidPlaces: number; estimatedMonthly: number; currency: string };
  gifts: { activePlaces: number; accounts: number };
  trackers: { active: number; finished: number; paused: number; withError: number };
  feedbackNew: number;
  outboxPending: number;
}

export interface SourceHealthRow {
  kind: string;
  active: number;
  withError: number;
  overdue: number;
  lastCheckedAt: string | null;
  topErrors: { error: string; count: number }[];
}

export type MutationResult<T = undefined> =
  | { ok: true; value: T }
  | { ok: false; reason: "NOT_FOUND" | "INVALID" | "DUPLICATE" };

const FEEDBACK_STATUSES = ["NEW", "READ", "ANSWERED", "SPAM"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LIST = FEEDBACK_STATUSES;

export const NEWS_SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/;
const NEWS_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface NewsTranslation {
  title: string;
  summary: string;
  body: string;
}

/** One news entry of the admin area: the date and one text per language. */
export interface NewsEntryDto {
  slug: string;
  date: string;
  time: string;
  translations: Partial<Record<Locale, NewsTranslation>>;
}

const DAY_MS = 86_400_000;

export function createAdminService(deps: {
  prisma: PrismaClient;
  now: () => Date;
  access: AccessService;
  billing: BillingService;
  grants: GrantService;
  trackers: TrackerService;
}) {
  const { prisma, now, access, billing, grants, trackers } = deps;

  /** Writes one audit entry. A repeated `requestId` is the same form sent twice: returns false then. */
  async function record(entry: {
    actor: Actor;
    action: string;
    target?: { id: string; email: string } | null;
    details?: Record<string, unknown>;
    requestId?: string | null;
  }): Promise<boolean> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actor.id,
          actorEmail: entry.actor.email,
          action: entry.action,
          targetUserId: entry.target?.id ?? null,
          targetEmail: entry.target?.email ?? null,
          details: (entry.details ?? {}) as object,
          requestId: entry.requestId ?? null,
        },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return false;
      throw error;
    }
  }

  async function overview(): Promise<OverviewDto> {
    const at = now();
    const week = new Date(at.getTime() - 7 * DAY_MS);
    const [total, recent, staff, subs, gifts, trackerGroups, withError, feedbackNew, outboxPending] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gt: week } } }),
      prisma.user.count({ where: { role: { not: "USER" } } }),
      prisma.user.groupBy({
        by: ["paidCases"],
        where: { subscriptionUntil: { gt: at } },
        _count: { _all: true },
      }),
      prisma.freeGrant.findMany({
        where: { revokedAt: null, startsAt: { lte: at }, OR: [{ expiresAt: null }, { expiresAt: { gt: at } }], kind: { not: "TRIAL" } },
        select: { userId: true, cases: true },
      }),
      prisma.tracker.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.tracker.count({ where: { status: "ACTIVE", lastError: { not: null } } }),
      prisma.feedbackMessage.count({ where: { status: "NEW" } }),
      prisma.telegramOutbox.count({ where: { sentAt: null } }),
    ]);
    const running = subs.reduce((n, row) => n + row._count._all, 0);
    const paidPlaces = subs.reduce((n, row) => n + row.paidCases * row._count._all, 0);
    const monthly = subs.reduce((n, row) => n + casesPrice(row.paidCases) * row._count._all, 0);
    const byStatus = Object.fromEntries(trackerGroups.map((row) => [row.status, row._count._all]));
    return {
      users: { total, newLast7Days: recent, staff },
      subscriptions: { running, paidPlaces, estimatedMonthly: monthly, currency: "ARS" },
      gifts: {
        activePlaces: gifts.reduce((n, row) => n + row.cases, 0),
        accounts: new Set(gifts.map((row) => row.userId)).size,
      },
      trackers: {
        active: (byStatus.ACTIVE ?? 0) + (byStatus.PENDING_CONFIRMATION ?? 0),
        finished: byStatus.FINISHED ?? 0,
        paused: byStatus.PAUSED ?? 0,
        withError,
      },
      feedbackNew,
      outboxPending,
    };
  }

  async function userDetail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const [accessState, state, grantList, trackerRows] = await Promise.all([
      access.get(userId),
      billing.state(userId),
      grants.list(userId),
      prisma.tracker.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { snapshot: true } }),
    ]);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        earlyAccess: user.earlyAccess,
        locale: user.locale,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerifiedAt !== null,
        firstName: user.firstName,
        lastName: user.lastName,
        telegramLinked: user.telegramId !== null,
        telegramUsername: user.telegramUsername,
        subscriptionUntil: user.subscriptionUntil ? user.subscriptionUntil.toISOString() : null,
        paidCases: user.paidCases,
        renews: user.subscriptionCancelledAt === null,
      },
      access: accessState,
      billing: state,
      grants: grantList,
      trackers: trackerRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        reference: row.reference,
        label: row.label,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
        lastError: row.lastError,
        keepNext: row.keepNext,
        notifyTelegram: row.notifyTelegram,
        header: (row.snapshot?.header ?? {}) as Record<string, string>,
      })),
    };
  }

  async function giveGrant(
    actor: Actor,
    input: {
      userId: string;
      kind: string;
      cases: number;
      expiresAt: Date | null;
      note?: string | null;
      requestId?: string | null;
    },
  ): Promise<MutationResult<{ grantId: string }>> {
    if (!GRANT_KINDS.includes(input.kind as GrantKind) || input.kind === "TRIAL") return { ok: false, reason: "INVALID" };
    if (!Number.isInteger(input.cases) || input.cases < 1 || input.cases > APP_CONFIG.limits.maxCases) {
      return { ok: false, reason: "INVALID" };
    }
    if (input.expiresAt && input.expiresAt <= now()) return { ok: false, reason: "INVALID" };
    const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true } });
    if (!target) return { ok: false, reason: "NOT_FOUND" };
    // the audit entry goes first: a form sent twice carries the same key and is stopped here
    const fresh = await record({
      actor,
      action: "grant.give",
      target,
      details: { kind: input.kind, cases: input.cases, expiresAt: input.expiresAt?.toISOString() ?? null, note: input.note ?? null },
      requestId: input.requestId ?? null,
    });
    if (!fresh) return { ok: false, reason: "DUPLICATE" };
    const grant = await grants.give({
      userId: target.id,
      kind: input.kind as GrantKind,
      cases: input.cases,
      expiresAt: input.expiresAt,
      note: input.note ?? null,
      grantedBy: actor.email,
    });
    return { ok: true, value: { grantId: grant.id } };
  }

  async function grantTarget(grantId: string) {
    const grant = await prisma.freeGrant.findUnique({
      where: { id: grantId },
      include: { user: { select: { id: true, email: true } } },
    });
    return grant && !grant.revokedAt ? grant : null;
  }

  async function revokeGrant(actor: Actor, grantId: string, requestId?: string | null): Promise<MutationResult> {
    const grant = await grantTarget(grantId);
    if (!grant) return { ok: false, reason: "NOT_FOUND" };
    const fresh = await record({
      actor,
      action: "grant.revoke",
      target: grant.user,
      details: { grantId, kind: grant.kind, cases: grant.cases },
      requestId: requestId ?? null,
    });
    if (!fresh) return { ok: false, reason: "DUPLICATE" };
    await grants.revoke(grantId);
    return { ok: true, value: undefined };
  }

  async function setGrantExpiry(
    actor: Actor,
    grantId: string,
    expiresAt: Date | null,
    requestId?: string | null,
  ): Promise<MutationResult> {
    const grant = await grantTarget(grantId);
    if (!grant) return { ok: false, reason: "NOT_FOUND" };
    if (expiresAt && expiresAt <= now()) return { ok: false, reason: "INVALID" };
    const fresh = await record({
      actor,
      action: "grant.expiry",
      target: grant.user,
      details: {
        grantId,
        kind: grant.kind,
        from: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        to: expiresAt ? expiresAt.toISOString() : null,
      },
      requestId: requestId ?? null,
    });
    if (!fresh) return { ok: false, reason: "DUPLICATE" };
    await grants.setExpiry(grantId, expiresAt);
    return { ok: true, value: undefined };
  }

  /** Turns early access (services not open to everyone yet) on or off for an account. */
  async function setEarlyAccess(actor: Actor, userId: string, enabled: boolean): Promise<MutationResult> {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, earlyAccess: true } });
    if (!target) return { ok: false, reason: "NOT_FOUND" };
    if (target.earlyAccess === enabled) return { ok: true, value: undefined };
    await prisma.user.update({ where: { id: userId }, data: { earlyAccess: enabled } });
    await record({ actor, action: "user.earlyAccess", target, details: { from: target.earlyAccess, to: enabled } });
    return { ok: true, value: undefined };
  }

  /** One inbox message for reading. Opening a new message marks it as read. */
  async function openFeedback(actor: Actor, id: string) {
    const row = await prisma.feedbackMessage.findUnique({ where: { id } });
    if (!row) return null;
    let status = row.status;
    if (status === "NEW") {
      status = "READ";
      await prisma.feedbackMessage.update({ where: { id }, data: { status } });
      await record({ actor, action: "feedback.status", details: { id, from: "NEW", to: "READ" } });
    }
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      topic: row.topic,
      name: row.name,
      email: row.email,
      message: row.message,
      locale: row.locale,
      status,
      userId: row.userId,
      reply: row.reply,
      repliedAt: row.repliedAt?.toISOString() ?? null,
      repliedBy: row.repliedBy,
    };
  }

  /**
   * Answers an inbox message. SIMULATED: the text is stored and the message moves to "answered", but no
   * e-mail leaves yet (the support mailbox is not connected).
   */
  async function replyFeedback(actor: Actor, id: string, text: string): Promise<MutationResult> {
    const reply = text.trim();
    if (reply === "" || reply.length > 5000) return { ok: false, reason: "INVALID" };
    const row = await prisma.feedbackMessage.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!row) return { ok: false, reason: "NOT_FOUND" };
    await prisma.feedbackMessage.update({
      where: { id },
      data: { reply, repliedAt: now(), repliedBy: actor.email, status: "ANSWERED" },
    });
    await record({ actor, action: "feedback.reply", details: { id, to: row.email, simulated: true } });
    return { ok: true, value: undefined };
  }

  async function setFeedbackStatus(actor: Actor, id: string, status: string): Promise<MutationResult> {
    if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) return { ok: false, reason: "INVALID" };
    const row = await prisma.feedbackMessage.findUnique({ where: { id }, select: { id: true, status: true, email: true } });
    if (!row) return { ok: false, reason: "NOT_FOUND" };
    if (row.status === status) return { ok: true, value: undefined };
    await prisma.feedbackMessage.update({ where: { id }, data: { status } });
    await record({ actor, action: "feedback.status", details: { id, from: row.status, to: status } });
    return { ok: true, value: undefined };
  }

  /** Ends a subscription at once and clears the test payment log of the account (test provider only). */
  async function resetSubscription(actor: Actor, userId: string): Promise<MutationResult> {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) return { ok: false, reason: "NOT_FOUND" };
    await access.resetSubscription(userId);
    await record({ actor, action: "subscription.reset", target });
    return { ok: true, value: undefined };
  }

  /** Simulates the renewal: one more period at the price of the places the account keeps. */
  async function renewSubscription(actor: Actor, userId: string): Promise<MutationResult> {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!target) return { ok: false, reason: "NOT_FOUND" };
    const result = await billing.renew(userId);
    if (!result.ok) return { ok: false, reason: "INVALID" };
    await record({ actor, action: "subscription.renew", target, details: { amount: result.quote.amount } });
    return { ok: true, value: undefined };
  }

  /** Entries written in the admin area, newest first. */
  async function listNews(): Promise<NewsEntryDto[]> {
    const rows = await prisma.newsPost.findMany({ orderBy: [{ date: "desc" }, { time: "desc" }, { slug: "asc" }] });
    const bySlug = new Map<string, NewsEntryDto>();
    for (const row of rows) {
      const entry = bySlug.get(row.slug) ?? { slug: row.slug, date: row.date, time: row.time, translations: {} };
      entry.translations[row.locale as Locale] = { title: row.title, summary: row.summary, body: row.body };
      bySlug.set(row.slug, entry);
    }
    return [...bySlug.values()];
  }

  /**
   * Publishes or changes an entry in all languages at once. The default language is required; a language left
   * empty is removed from the entry (readers then get the default one). The date comes from the slug.
   */
  async function saveNews(
    actor: Actor,
    input: { slug: string; time: string; translations: Partial<Record<Locale, NewsTranslation>> },
  ): Promise<MutationResult> {
    if (!NEWS_SLUG_PATTERN.test(input.slug) || !NEWS_TIME_PATTERN.test(input.time)) return { ok: false, reason: "INVALID" };
    const date = input.slug.slice(0, 10);
    if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, reason: "INVALID" };
    const filled = (item: NewsTranslation | undefined) =>
      item !== undefined && item.title.trim() !== "" && item.body.trim() !== "";
    if (!filled(input.translations[APP_CONFIG.defaultLocale])) return { ok: false, reason: "INVALID" };
    const saved: string[] = [];
    for (const locale of LOCALES) {
      const item = input.translations[locale];
      if (!filled(item)) {
        await prisma.newsPost.deleteMany({ where: { slug: input.slug, locale } });
        continue;
      }
      const data = { date, time: input.time, title: item!.title.trim(), summary: item!.summary.trim(), body: item!.body.trim() };
      await prisma.newsPost.upsert({
        where: { slug_locale: { slug: input.slug, locale } },
        create: { slug: input.slug, locale, ...data },
        update: data,
      });
      saved.push(locale);
    }
    await record({ actor, action: "news.save", details: { slug: input.slug, locales: saved } });
    return { ok: true, value: undefined };
  }

  async function deleteNews(actor: Actor, slug: string): Promise<MutationResult> {
    const { count } = await prisma.newsPost.deleteMany({ where: { slug } });
    if (count === 0) return { ok: false, reason: "NOT_FOUND" };
    await record({ actor, action: "news.delete", details: { slug } });
    return { ok: true, value: undefined };
  }

  /** Every stored row, for the public pages (merged with the entries kept in files). */
  async function publishedNews() {
    return prisma.newsPost.findMany();
  }

  async function sourcesHealth(): Promise<SourceHealthRow[]> {
    const at = now();
    const overdueBefore = new Date(at.getTime() - 60 * 60_000);
    const kinds = await prisma.tracker.groupBy({ by: ["kind"], where: { status: "ACTIVE" }, _count: { _all: true } });
    return Promise.all(
      kinds.map(async (row): Promise<SourceHealthRow> => {
        const [withError, overdue, last, errors] = await Promise.all([
          prisma.tracker.count({ where: { kind: row.kind, status: "ACTIVE", lastError: { not: null } } }),
          prisma.tracker.count({ where: { kind: row.kind, status: "ACTIVE", nextCheckAt: { lt: overdueBefore } } }),
          prisma.tracker.aggregate({ where: { kind: row.kind, status: "ACTIVE" }, _max: { lastCheckedAt: true } }),
          prisma.tracker.groupBy({
            by: ["lastError"],
            where: { kind: row.kind, status: "ACTIVE", lastError: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { lastError: "desc" } },
            take: 3,
          }),
        ]);
        return {
          kind: row.kind,
          active: row._count._all,
          withError,
          overdue,
          lastCheckedAt: last._max.lastCheckedAt ? last._max.lastCheckedAt.toISOString() : null,
          topErrors: errors.map((error) => ({ error: error.lastError ?? "", count: error._count._all })),
        };
      }),
    );
  }

  async function statusStats(kind?: TrackerKindValue) {
    return trackers.statusStats(kind);
  }

  const lists = createAdminLists({ prisma, now });

  return {
    overview,
    listUsers: lists.users,
    userPayments: lists.payments,
    auditLog: lists.audit,
    economics: lists.economics,
    listFeedback: (input: Parameters<typeof lists.feedback>[0]) => lists.feedback(input, FEEDBACK_STATUSES),
    userDetail,
    giveGrant,
    revokeGrant,
    setGrantExpiry,
    setEarlyAccess,
    setFeedbackStatus,
    openFeedback,
    replyFeedback,
    resetSubscription,
    renewSubscription,
    listNews,
    saveNews,
    deleteNews,
    publishedNews,
    sourcesHealth,
    statusStats,
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
