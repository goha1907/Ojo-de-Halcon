import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, casesPrice, type TrackerKindValue } from "@ojo/shared";
import type { AccessService } from "../access/access-service";
import type { BillingService } from "../billing/billing-service";
import type { CapacityService } from "../capacity/capacity-service";
import { GRANT_KINDS, type GrantKind, type GrantService } from "../grants/grant-service";
import type { TrackerService } from "../trackers/tracker-service";

/** Who is acting in the admin area (copied into the audit log). */
export interface Actor {
  id: string;
  email: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OverviewDto {
  users: { total: number; newLast7Days: number; staff: number };
  subscriptions: { running: number; paidPlaces: number; estimatedMonthly: number; currency: string };
  gifts: { activePlaces: number; accounts: number };
  trackers: { active: number; finished: number; paused: number; withError: number };
  feedbackNew: number;
  outboxPending: number;
}

export interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  emailVerified: boolean;
  telegramLinked: boolean;
  plan: string;
  places: number;
  cases: number;
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

const DAY_MS = 86_400_000;

export function createAdminService(deps: {
  prisma: PrismaClient;
  now: () => Date;
  access: AccessService;
  billing: BillingService;
  capacity: CapacityService;
  grants: GrantService;
  trackers: TrackerService;
}) {
  const { prisma, now, access, billing, capacity, grants, trackers } = deps;

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

  async function listUsers(input: { query?: string; page?: number; pageSize?: number }): Promise<Page<UserRow>> {
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const page = Math.max(1, input.page ?? 1);
    const query = (input.query ?? "").trim();
    const where = query
      ? { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { id: query }] }
      : {};
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { trackers: { where: { status: { in: ["ACTIVE", "PENDING_CONFIRMATION"] } } } } } },
      }),
    ]);
    const items = await Promise.all(
      rows.map(async (row): Promise<UserRow> => {
        const places = await capacity.get(row.id);
        return {
          id: row.id,
          email: row.email,
          role: row.role,
          createdAt: row.createdAt.toISOString(),
          emailVerified: row.emailVerifiedAt !== null,
          telegramLinked: row.telegramId !== null,
          plan: places.running ? "subscription" : places.granted > 0 ? (places.gift > 0 ? "gift" : "trial") : "none",
          places: places.total,
          cases: row._count.trackers,
        };
      }),
    );
    return { items, total, page, pageSize };
  }

  async function userDetail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    const [accessState, state, grantList, trackerRows, payments, audit] = await Promise.all([
      access.get(userId),
      billing.state(userId),
      grants.list(userId),
      prisma.tracker.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { snapshot: true } }),
      prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.auditLog.findMany({ where: { targetUserId: userId }, orderBy: { createdAt: "desc" }, take: 20 }),
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
      payments: payments.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        amount: row.amount,
        currency: row.currency,
        kind: row.kind,
        casesDelta: row.casesDelta,
        provider: row.provider,
      })),
      audit: audit.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actorEmail: row.actorEmail,
        action: row.action,
        details: row.details as Record<string, unknown> | null,
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

  async function listFeedback(input: { status?: string; page?: number; pageSize?: number }) {
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
    const page = Math.max(1, input.page ?? 1);
    const where = input.status && (FEEDBACK_STATUSES as readonly string[]).includes(input.status) ? { status: input.status } : {};
    const [total, rows] = await Promise.all([
      prisma.feedbackMessage.count({ where }),
      prisma.feedbackMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        topic: row.topic,
        name: row.name,
        email: row.email,
        message: row.message,
        locale: row.locale,
        status: row.status,
        userId: row.userId,
      })),
    };
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

  async function auditLog(input: { page?: number; pageSize?: number }) {
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
    const page = Math.max(1, input.page ?? 1);
    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return {
      total,
      page,
      pageSize,
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actorEmail: row.actorEmail,
        action: row.action,
        targetUserId: row.targetUserId,
        targetEmail: row.targetEmail,
        details: row.details as Record<string, unknown> | null,
      })),
    };
  }

  return {
    overview,
    listUsers,
    userDetail,
    giveGrant,
    revokeGrant,
    setGrantExpiry,
    setEarlyAccess,
    listFeedback,
    setFeedbackStatus,
    sourcesHealth,
    statusStats,
    auditLog,
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
