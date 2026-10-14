import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, PRICING, casesPrice, quotePurchase } from "@ojo/shared";

const DAY_MS = 86_400_000;
const PROVIDER = "stub";
/** Statuses of a case that occupies a paid slot. */
const OCCUPYING = ["ACTIVE", "PENDING_CONFIRMATION"] as const;

export interface QuoteDto {
  mode: "new_period" | "extra";
  amount: number;
  currency: string;
  periodEnd: string;
  casesAfter: number;
  addCases: number;
}

export interface BillingStateDto {
  /** Cases the running period is paid for. */
  paidCases: number;
  /** Cases occupying a slot now (tracked, including those marked for removal). */
  activeCases: number;
  /** Paid slots nobody occupies. */
  freeCases: number;
  /** Tracked cases that stay in the subscription at renewal. */
  keptCases: number;
  /** Tracked cases marked for removal: they run until the period ends. */
  cancelledCases: number;
  /** Cases the source reported as completed (their slot is free). */
  finishedCases: number;
  /** Cases left out of the subscription; kept for history. */
  pausedCases: number;
  maxCases: number;
  currency: string;
  /** Price of the running period for the paid cases. */
  currentPrice: number;
  /** Price of the next period: the cases that stay. */
  nextPeriodPrice: number;
}

export interface PaymentDto {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  casesDelta: number;
  createdAt: string;
}

export type CheckoutResult =
  | { ok: true; quote: QuoteDto }
  | { ok: false; reason: "INVALID_CASES" | "LIMIT_REACHED" };

export type RenewResult = { ok: true; quote: QuoteDto } | { ok: false; reason: "NO_CASES" };

export type TrackerBillingResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "SUBSCRIPTION_REQUIRED" | "NO_FREE_SLOT" };

function toQuoteDto(quote: ReturnType<typeof quotePurchase>): QuoteDto {
  return { ...quote, periodEnd: quote.periodEnd.toISOString() };
}

export function createBillingService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function counts(userId: string) {
    const rows = await prisma.tracker.groupBy({
      by: ["status", "keepNext"],
      where: { userId },
      _count: { _all: true },
    });
    const sum = (match: (row: (typeof rows)[number]) => boolean) =>
      rows.filter(match).reduce((total, row) => total + row._count._all, 0);
    const occupying = (row: (typeof rows)[number]) => (OCCUPYING as readonly string[]).includes(row.status);
    return {
      active: sum(occupying),
      kept: sum((row) => occupying(row) && row.keepNext),
      cancelled: sum((row) => occupying(row) && !row.keepNext),
      finished: sum((row) => row.status === "FINISHED"),
      paused: sum((row) => row.status === "PAUSED"),
    };
  }

  async function load(userId: string) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionUntil: true, paidCases: true },
    });
  }

  function isRunning(until: Date | null): boolean {
    return until !== null && until > now();
  }

  async function state(userId: string): Promise<BillingStateDto> {
    const [user, count] = await Promise.all([load(userId), counts(userId)]);
    // an ended period pays for nothing: the slots are bought again at renewal
    const paid = isRunning(user.subscriptionUntil) ? user.paidCases : 0;
    return {
      paidCases: paid,
      activeCases: count.active,
      freeCases: Math.max(0, paid - count.active),
      keptCases: count.kept,
      cancelledCases: count.cancelled,
      finishedCases: count.finished,
      pausedCases: count.paused,
      maxCases: APP_CONFIG.limits.maxCases,
      currency: PRICING.currency,
      currentPrice: casesPrice(paid),
      nextPeriodPrice: casesPrice(count.kept),
    };
  }

  /**
   * Price of holding `targetCases` cases in total. Without a running period that is a
   * full period (never fewer than the cases kept); inside one only the added cases are
   * charged and the renewal date stays.
   */
  async function quote(userId: string, targetCases: number): Promise<CheckoutResult> {
    if (!Number.isInteger(targetCases) || targetCases < 1) return { ok: false, reason: "INVALID_CASES" };
    if (targetCases > APP_CONFIG.limits.maxCases) return { ok: false, reason: "LIMIT_REACHED" };
    const [user, count] = await Promise.all([load(userId), counts(userId)]);
    const running = isRunning(user.subscriptionUntil);
    if (running ? targetCases < user.paidCases : targetCases < count.kept) {
      return { ok: false, reason: "INVALID_CASES" };
    }
    return {
      ok: true,
      quote: toQuoteDto(
        quotePurchase({
          subscriptionUntil: user.subscriptionUntil,
          paidCases: user.paidCases,
          targetCases,
          now: now(),
        }),
      ),
    };
  }

  /** Cases marked for removal leave the subscription: they are paused, the history stays. */
  function pauseCancelled(userId: string) {
    return prisma.tracker.updateMany({
      where: { userId, keepNext: false, status: { in: [...OCCUPYING] } },
      data: { status: "PAUSED", pausedAt: now(), keepNext: true },
    });
  }

  /**
   * Pays for cases (and starts the period when none is running). Called by the payment
   * provider's confirmation; the stub calls it directly. Slots exist only after this
   * succeeds, so nothing is added before payment.
   */
  async function checkout(userId: string, targetCases: number): Promise<CheckoutResult> {
    const priced = await quote(userId, targetCases);
    if (!priced.ok) return priced;
    const { quote: q } = priced;
    if (q.addCases === 0) return priced;
    await prisma.$transaction([
      ...(q.mode === "new_period" ? [pauseCancelled(userId)] : []),
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: new Date(q.periodEnd), paidCases: q.casesAfter },
      }),
      prisma.payment.create({
        data: {
          userId,
          amount: q.amount,
          currency: q.currency,
          kind: q.mode === "new_period" ? "subscription" : "cases",
          casesDelta: q.addCases,
          provider: PROVIDER,
        },
      }),
    ]);
    return priced;
  }

  /**
   * Renewal for one more period (early, or after the period ended): the cases that
   * stay are charged, the ones marked for removal leave the subscription.
   */
  async function renew(userId: string): Promise<RenewResult> {
    const [user, count] = await Promise.all([load(userId), counts(userId)]);
    if (count.kept === 0) return { ok: false, reason: "NO_CASES" };
    const from = isRunning(user.subscriptionUntil) ? user.subscriptionUntil! : now();
    const until = new Date(from.getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS);
    const amount = casesPrice(count.kept);
    await prisma.$transaction([
      pauseCancelled(userId),
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: until, paidCases: count.kept },
      }),
      prisma.payment.create({
        data: {
          userId,
          amount,
          currency: PRICING.currency,
          kind: "renewal",
          casesDelta: 0,
          provider: PROVIDER,
        },
      }),
    ]);
    return {
      ok: true,
      quote: {
        mode: "new_period",
        amount,
        currency: PRICING.currency,
        periodEnd: until.toISOString(),
        casesAfter: count.kept,
        addCases: 0,
      },
    };
  }

  /**
   * Marks a tracked case for removal from the next period (or takes the mark back).
   * Nothing is lost: the case keeps running until the period ends, then stays in the
   * cabinet as history.
   */
  async function setKept(userId: string, trackerId: string, kept: boolean): Promise<TrackerBillingResult> {
    const user = await load(userId);
    if (!isRunning(user.subscriptionUntil)) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    const result = await prisma.tracker.updateMany({
      where: { id: trackerId, userId, status: { in: [...OCCUPYING] } },
      data: { keepNext: kept },
    });
    return result.count === 1 ? { ok: true } : { ok: false, reason: "NOT_FOUND" };
  }

  /** Marks every tracked case for removal, or takes all the marks back. */
  async function setSubscriptionKept(userId: string, kept: boolean): Promise<TrackerBillingResult> {
    const user = await load(userId);
    if (!isRunning(user.subscriptionUntil)) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    await prisma.tracker.updateMany({
      where: { userId, status: { in: [...OCCUPYING] } },
      data: { keepNext: kept },
    });
    return { ok: true };
  }

  /**
   * Puts a paused case back under tracking. It needs a free paid slot (buy more cases
   * first when there is none); the number is read again right away.
   */
  async function resume(userId: string, trackerId: string): Promise<TrackerBillingResult> {
    const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, userId, status: "PAUSED" } });
    if (!tracker) return { ok: false, reason: "NOT_FOUND" };
    const [user, count] = await Promise.all([load(userId), counts(userId)]);
    if (!isRunning(user.subscriptionUntil)) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    if (count.active >= user.paidCases) return { ok: false, reason: "NO_FREE_SLOT" };
    await prisma.tracker.update({
      where: { id: tracker.id },
      data: { status: "ACTIVE", pausedAt: null, keepNext: true, lastError: null, nextCheckAt: now() },
    });
    return { ok: true };
  }

  async function history(userId: string, limit = 20): Promise<PaymentDto[]> {
    const rows = await prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      currency: row.currency,
      kind: row.kind,
      casesDelta: row.casesDelta,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  return { state, quote, checkout, renew, setKept, setSubscriptionKept, resume, history };
}

export type BillingService = ReturnType<typeof createBillingService>;
