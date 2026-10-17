import type { Prisma, PrismaClient } from "@ojo/db";
import { casesPrice } from "@ojo/shared";
import { activeGrantWhere } from "../capacity/capacity-service";

/** Common shape of a list request in the admin area. */
export interface ListQuery {
  page?: number;
  pageSize?: number;
  /** Column to sort by (each list has its own allowed columns; an unknown one falls back to the default). */
  sort?: string;
  dir?: "asc" | "desc";
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserListQuery extends ListQuery {
  query?: string;
  role?: string;
  plan?: string;
  gift?: string;
  cases?: string;
  telegram?: string;
  verified?: string;
  earlyAccess?: string;
  from?: string;
  to?: string;
}

export interface UserRow {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  emailVerified: boolean;
  telegramLinked: boolean;
  plan: string;
  /** All places: paid, trial and gift. */
  places: number;
  /** Bonus places in use (the trial is not counted). */
  gift: number;
  cases: number;
}

const DAY_MS = 86_400_000;
const ROLES = ["USER", "SUPPORT", "ADMIN"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function paging(input: ListQuery, fallbackSize: number) {
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? fallbackSize));
  const page = Math.max(1, Math.trunc(input.page ?? 1) || 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** `from`/`to` as `YYYY-MM-DD` (both days included) into a date range; anything else is ignored. */
export function dayRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  const range: { gte?: Date; lt?: Date } = {};
  if (from && DATE.test(from) && !Number.isNaN(Date.parse(`${from}T00:00:00Z`))) range.gte = new Date(`${from}T00:00:00Z`);
  if (to && DATE.test(to) && !Number.isNaN(Date.parse(`${to}T00:00:00Z`))) range.lt = new Date(Date.parse(`${to}T00:00:00Z`) + DAY_MS);
  return range.gte || range.lt ? range : undefined;
}

function direction(input: ListQuery, fallback: "asc" | "desc"): "asc" | "desc" {
  return input.dir === "asc" || input.dir === "desc" ? input.dir : fallback;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Lists of the admin area with filters, sorting and paging done in the database (users: see `users`). */
export function createAdminLists(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  /**
   * Accounts. The plan, bonus places and case counts are computed in bulk (a few grouped queries), so any of
   * them can be filtered and sorted on without reading every account one by one.
   */
  async function users(input: UserListQuery): Promise<Page<UserRow>> {
    const at = now();
    const { page, pageSize, skip } = paging(input, 25);
    const query = (input.query ?? "").trim();
    const and: Prisma.UserWhereInput[] = [];
    if (query) and.push({ OR: [{ email: { contains: query, mode: "insensitive" } }, { id: query }] });
    if (input.role === "staff") and.push({ role: { not: "USER" } });
    else if (input.role && ROLES.includes(input.role)) and.push({ role: input.role as "USER" | "SUPPORT" | "ADMIN" });
    const running: Prisma.UserWhereInput = { subscriptionUntil: { gt: at } };
    // written without NOT: a missing end date is NULL in SQL, and NOT (NULL > x) would drop the row
    const idle: Prisma.UserWhereInput = { OR: [{ subscriptionUntil: null }, { subscriptionUntil: { lte: at } }] };
    const giftGrant: Prisma.UserWhereInput = { freeGrants: { some: { kind: { not: "TRIAL" }, ...activeGrantWhere(at) } } };
    const trialGrant: Prisma.UserWhereInput = { freeGrants: { some: { kind: "TRIAL", ...activeGrantWhere(at) } } };
    if (input.plan === "subscription") and.push(running);
    else if (input.plan === "gift") and.push(idle, giftGrant);
    else if (input.plan === "trial") and.push(idle, { NOT: giftGrant }, trialGrant);
    else if (input.plan === "none") and.push(idle, { NOT: giftGrant }, { NOT: trialGrant });
    if (input.gift === "yes") and.push(giftGrant);
    const live = { status: { in: ["ACTIVE" as const, "PENDING_CONFIRMATION" as const] } };
    if (input.cases === "active") and.push({ trackers: { some: live } });
    else if (input.cases === "none") and.push({ trackers: { none: live } });
    if (input.telegram === "yes") and.push({ telegramId: { not: null } });
    else if (input.telegram === "no") and.push({ telegramId: null });
    if (input.verified === "yes") and.push({ emailVerifiedAt: { not: null } });
    else if (input.verified === "no") and.push({ emailVerifiedAt: null });
    if (input.earlyAccess === "yes") and.push({ earlyAccess: true });
    const joined = dayRange(input.from, input.to);
    if (joined) and.push({ createdAt: joined });
    const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};

    const [rows, grantGroups, caseGroups] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, email: true, role: true, createdAt: true, emailVerifiedAt: true, telegramId: true, subscriptionUntil: true, paidCases: true },
      }),
      prisma.freeGrant.groupBy({ by: ["userId", "kind"], where: activeGrantWhere(at), _sum: { cases: true } }),
      prisma.tracker.groupBy({ by: ["userId"], where: live, _count: { _all: true } }),
    ]);
    const trial = new Map<string, number>();
    const gift = new Map<string, number>();
    for (const group of grantGroups) {
      const target = group.kind === "TRIAL" ? trial : gift;
      target.set(group.userId, (target.get(group.userId) ?? 0) + (group._sum.cases ?? 0));
    }
    const cases = new Map(caseGroups.map((group) => [group.userId, group._count._all]));

    const all = rows.map((row): UserRow => {
      const isRunning = row.subscriptionUntil !== null && row.subscriptionUntil > at;
      const giftPlaces = gift.get(row.id) ?? 0;
      const trialPlaces = trial.get(row.id) ?? 0;
      return {
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.createdAt.toISOString(),
        emailVerified: row.emailVerifiedAt !== null,
        telegramLinked: row.telegramId !== null,
        plan: isRunning ? "subscription" : giftPlaces > 0 ? "gift" : trialPlaces > 0 ? "trial" : "none",
        places: (isRunning ? row.paidCases : 0) + giftPlaces + trialPlaces,
        gift: giftPlaces,
        cases: cases.get(row.id) ?? 0,
      };
    });
    const sort = pick(input.sort, ["email", "role", "plan", "places", "gift", "cases", "createdAt"] as const, "createdAt");
    const sign = direction(input, "desc") === "asc" ? 1 : -1;
    all.sort((a, b) => {
      const left = a[sort];
      const right = b[sort];
      const order = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return sign * order || b.createdAt.localeCompare(a.createdAt) || a.email.localeCompare(b.email);
    });
    return { items: all.slice(skip, skip + pageSize), total: all.length, page, pageSize };
  }

  async function payments(userId: string, input: ListQuery & { kind?: string; provider?: string; from?: string; to?: string }) {
    const { page, pageSize, skip } = paging(input, 10);
    const where: Prisma.PaymentWhereInput = {
      userId,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
      ...(dayRange(input.from, input.to) ? { createdAt: dayRange(input.from, input.to)! } : {}),
    };
    const sort = pick(input.sort, ["createdAt", "amount", "kind", "provider"] as const, "createdAt");
    const [total, rows, kinds, providers] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({ where, orderBy: { [sort]: direction(input, "desc") }, skip, take: pageSize }),
      prisma.payment.findMany({ where: { userId }, distinct: ["kind"], select: { kind: true } }),
      prisma.payment.findMany({ where: { userId }, distinct: ["provider"], select: { provider: true } }),
    ]);
    return {
      total,
      page,
      pageSize,
      kinds: kinds.map((row) => row.kind),
      providers: providers.map((row) => row.provider),
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        amount: row.amount,
        currency: row.currency,
        kind: row.kind,
        casesDelta: row.casesDelta,
        provider: row.provider,
        method: row.method,
        receiptUrl: row.receiptUrl,
      })),
    };
  }

  async function audit(input: ListQuery & { userId?: string; query?: string; action?: string; from?: string; to?: string }) {
    const { page, pageSize, skip } = paging(input, 25);
    const query = (input.query ?? "").trim();
    const where: Prisma.AuditLogWhereInput = {
      ...(input.userId ? { targetUserId: input.userId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(query
        ? { OR: [{ actorEmail: { contains: query, mode: "insensitive" } }, { targetEmail: { contains: query, mode: "insensitive" } }] }
        : {}),
      ...(dayRange(input.from, input.to) ? { createdAt: dayRange(input.from, input.to)! } : {}),
    };
    const sort = pick(input.sort, ["createdAt", "action", "actorEmail", "targetEmail"] as const, "createdAt");
    const [total, rows, actions] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { [sort]: direction(input, "desc") }, skip, take: pageSize }),
      prisma.auditLog.findMany({ where: input.userId ? { targetUserId: input.userId } : {}, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
    ]);
    return {
      total,
      page,
      pageSize,
      actions: actions.map((row) => row.action),
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

  async function feedback(
    input: ListQuery & { status?: string; query?: string; topic?: string; locale?: string; from?: string; to?: string },
    statuses: readonly string[],
  ) {
    const { page, pageSize, skip } = paging(input, 25);
    const query = (input.query ?? "").trim();
    const where: Prisma.FeedbackMessageWhereInput = {
      ...(input.status && statuses.includes(input.status) ? { status: input.status } : {}),
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
              { message: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(dayRange(input.from, input.to) ? { createdAt: dayRange(input.from, input.to)! } : {}),
    };
    const sort = pick(input.sort, ["createdAt", "status", "topic", "email"] as const, "createdAt");
    const [total, rows] = await Promise.all([
      prisma.feedbackMessage.count({ where }),
      prisma.feedbackMessage.findMany({ where, orderBy: { [sort]: direction(input, "desc") }, skip, take: pageSize }),
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
        replied: row.reply !== null,
      })),
    };
  }

  /** Money figures for the owner: running subscriptions, and what was paid by month. */
  async function economics(months = 12) {
    const at = now();
    const [subs, payments, grants] = await Promise.all([
      prisma.user.groupBy({ by: ["paidCases"], where: { subscriptionUntil: { gt: at } }, _count: { _all: true } }),
      prisma.payment.findMany({ select: { amount: true, currency: true, provider: true, kind: true, createdAt: true } }),
      prisma.freeGrant.findMany({ where: { kind: { not: "TRIAL" }, ...activeGrantWhere(at) }, select: { cases: true } }),
    ]);
    const running = subs.reduce((n, row) => n + row._count._all, 0);
    const paidPlaces = subs.reduce((n, row) => n + row.paidCases * row._count._all, 0);
    const monthly = subs.reduce((n, row) => n + casesPrice(row.paidCases) * row._count._all, 0);
    const byMonth = new Map<string, { real: number; test: number; count: number }>();
    const byKind = new Map<string, { real: number; test: number; count: number }>();
    const add = (map: Map<string, { real: number; test: number; count: number }>, key: string, amount: number, test: boolean) => {
      const entry = map.get(key) ?? { real: 0, test: 0, count: 0 };
      entry[test ? "test" : "real"] += amount;
      entry.count += 1;
      map.set(key, entry);
    };
    const since = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - (months - 1), 1));
    for (const row of payments) {
      const test = row.provider === "stub";
      add(byKind, row.kind, row.amount, test);
      if (row.createdAt >= since) add(byMonth, row.createdAt.toISOString().slice(0, 7), row.amount, test);
    }
    return {
      currency: "ARS",
      running,
      paidPlaces,
      estimatedMonthly: monthly,
      averagePerSubscription: running > 0 ? Math.round(monthly / running) : 0,
      giftPlaces: grants.reduce((n, row) => n + row.cases, 0),
      // what the bonus places would cost at the price ladder: the value given away
      giftValue: casesPrice(grants.reduce((n, row) => n + row.cases, 0)),
      byMonth: [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([month, value]) => ({ month, ...value })),
      byKind: [...byKind.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([kind, value]) => ({ kind, ...value })),
    };
  }

  return { users, payments, audit, feedback, economics };
}
