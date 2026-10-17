import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, PRICING, casesPrice, quotePurchase } from "@ojo/shared";
import type { CapacityService } from "../capacity/capacity-service";
import type { GrantService } from "../grants/grant-service";

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
  /** Cases held by the free places (they take cases first) and by the paid ones: they add up to `activeCases`. */
  grantedUsedCases: number;
  paidUsedCases: number;
  /** Places that cases can still take: paid and free ones together, minus the occupied. */
  freeCases: number;
  /** Cases the active free places cover (trial, bonus, gift kinds): they cost nothing. */
  grantedCases: number;
  /** All places right now: paid plus free. */
  capacity: number;
  /**
   * Why paid places are not paid for in the next period; the three add up to `paidCases - nextPeriodCases`.
   * Marked for removal / emptied by a case that finished this period / nobody uses them.
   */
  leavesMarked: number;
  freedByFinished: number;
  unusedCases: number;
  /** Paid places the bonus places will still cover at the renewal. */
  coveredByGiftCases: number;
  /** Paid places the next period needs for cases now on bonus places that end before the renewal. */
  incomingCases: number;
  /** Paid places the next period is charged for. */
  nextPeriodCases: number;
  /** Cases that completed during the running period (they held a place). */
  finishedThisPeriod: number;
  /** Tracked cases that stay in the subscription at renewal. */
  keptCases: number;
  /** Tracked cases marked for removal: they run until the period ends. */
  cancelledCases: number;
  /** Cases the source reported as completed, all time. */
  finishedCases: number;

  /** Cases left out of the subscription; kept for history. */
  pausedCases: number;
  maxCases: number;
  /** The subscription will not renew (cancelled); the cases keep running until the period ends. */
  renews: boolean;
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

export type RenewResult = { ok: true; quote: QuoteDto } | { ok: false; reason: "NO_CASES" | "CANCELLED" };

export type TrackerBillingResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "SUBSCRIPTION_REQUIRED" | "NO_FREE_SLOT" };

function toQuoteDto(quote: ReturnType<typeof quotePurchase>): QuoteDto {
  return { ...quote, periodEnd: quote.periodEnd.toISOString() };
}

export function createBillingService(deps: {
  prisma: PrismaClient;
  now: () => Date;
  grants: GrantService;
  capacity: CapacityService;
}) {
  const { prisma, now, grants, capacity } = deps;

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
      select: { subscriptionUntil: true, paidCases: true, subscriptionCancelledAt: true },
    });
  }

  function isRunning(until: Date | null): boolean {
    return until !== null && until > now();
  }

  /** Paid places the next period needs: the cases that stay, minus those the free places will cover. */
  async function nextPaid(userId: string, kept: number, periodEnd: Date): Promise<number> {
    // the trial place ends when a subscription starts, so it never covers the next period
    return Math.max(0, kept - (await capacity.grantedAt(userId, periodEnd, { withoutTrial: true })));
  }

  async function state(userId: string): Promise<BillingStateDto> {
    const at = now();
    const [user, count, places] = await Promise.all([load(userId), counts(userId), capacity.get(userId, at)]);
    const freeNow = places.granted;
    const running = places.running;
    // an ended period pays for nothing: the places are bought again at renewal
    const paid = places.paid;
    // the period started one subscription length before its end (extra purchases do not move it);
    // without a subscription the last month is the period
    const periodEnd = running ? user.subscriptionUntil! : new Date(at.getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS);
    const periodStart = new Date(periodEnd.getTime() - APP_CONFIG.limits.subscriptionDays * DAY_MS);
    const finishedThisPeriod = await prisma.tracker.count({
      where: { userId, status: "FINISHED", finishedAt: { gt: running ? periodStart : new Date(at.getTime() - APP_CONFIG.limits.subscriptionDays * DAY_MS) } },
    });
    const next = await nextPaid(userId, count.kept, periodEnd);
    // How the paid places go from today's to the next period's (they add up: paid - empty + incoming - shrink = next).
    // Empty now: nobody sits on them (finished cases freed some). The count of paid places in use changes by
    // `delta`: a case on a gift place that ends before the renewal moves to a paid one (incoming), while
    // marked cases and cases a gift place will still cover stop needing one (shrink).
    const paidUsed = Math.max(0, count.active - freeNow);
    const emptyPaid = Math.max(0, paid - paidUsed);
    const delta = next - paidUsed;
    const incoming = Math.max(0, delta);
    const shrink = Math.max(0, -delta);
    const leavesMarked = Math.min(count.cancelled, shrink);
    const freedByFinished = Math.min(finishedThisPeriod, emptyPaid);
    return {
      paidCases: paid,
      activeCases: count.active,
      freeCases: Math.max(0, paid + freeNow - count.active),
      grantedCases: freeNow,
      grantedUsedCases: Math.min(count.active, freeNow),
      paidUsedCases: Math.max(0, count.active - freeNow),
      capacity: paid + freeNow,
      freedByFinished,
      unusedCases: emptyPaid - freedByFinished,
      leavesMarked,
      coveredByGiftCases: shrink - leavesMarked,
      incomingCases: incoming,
      nextPeriodCases: next,
      finishedThisPeriod,
      keptCases: count.kept,
      cancelledCases: count.cancelled,
      finishedCases: count.finished,
      pausedCases: count.paused,
      maxCases: APP_CONFIG.limits.maxCases,
      renews: user.subscriptionCancelledAt === null,
      currency: PRICING.currency,
      currentPrice: casesPrice(paid),
      nextPeriodPrice: casesPrice(next),
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
    // a new period must at least hold the cases that stay, less those the free places cover
    const minimum = running
      ? user.paidCases
      : await nextPaid(userId, count.kept, new Date(now().getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS));
    if (targetCases < minimum) return { ok: false, reason: "INVALID_CASES" };
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
  async function checkout(
    userId: string,
    targetCases: number,
    paid?: { provider: string; method: string; intentId: string; amount: number },
  ): Promise<CheckoutResult> {
    const priced = await quote(userId, targetCases);
    if (!priced.ok) return priced;
    const { quote: q } = priced;
    if (q.addCases === 0) return priced;
    await prisma.$transaction([
      ...(q.mode === "new_period" ? [pauseCancelled(userId)] : []),
      // buying a subscription ends the trial place: the case moves to a paid place
      grants.endTrial(userId),
      prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionUntil: new Date(q.periodEnd),
          paidCases: q.casesAfter,
          // a new period is a new subscription: it renews
          ...(q.mode === "new_period" ? { subscriptionCancelledAt: null } : {}),
        },
      }),
      prisma.payment.create({
        data: {
          userId,
          // what was really paid (fixed when the checkout was created)
          amount: paid?.amount ?? q.amount,
          currency: q.currency,
          kind: q.mode === "new_period" ? "subscription" : "cases",
          casesDelta: q.addCases,
          provider: paid?.provider ?? PROVIDER,
          method: paid?.method ?? null,
          intentId: paid?.intentId ?? null,
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
    if (user.subscriptionCancelledAt !== null) return { ok: false, reason: "CANCELLED" };
    const from = isRunning(user.subscriptionUntil) ? user.subscriptionUntil! : now();
    const until = new Date(from.getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS);
    // free places cover cases first: only the rest is paid for
    const payFor = await nextPaid(userId, count.kept, until);
    if (payFor === 0) return { ok: false, reason: "NO_CASES" };
    const amount = casesPrice(payFor);
    await prisma.$transaction([
      pauseCancelled(userId),
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: until, paidCases: payFor },
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
        casesAfter: payFor,
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

  /**
   * Cancels the subscription (it will not renew) or returns it. Nothing happens to the cases: they
   * keep running until the paid period ends, and returning the subscription before that moment
   * just restores renewal. Marks on cases are a separate matter: they only feed the calculation
   * of the current and the next amount.
   */
  async function setRenewal(userId: string, renews: boolean): Promise<TrackerBillingResult> {
    const user = await load(userId);
    if (!isRunning(user.subscriptionUntil)) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionCancelledAt: renews ? null : now() },
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
    const [count, places] = await Promise.all([counts(userId), capacity.get(userId)]);
    if (places.total === 0) return { ok: false, reason: "SUBSCRIPTION_REQUIRED" };
    if (count.active >= places.total) return { ok: false, reason: "NO_FREE_SLOT" };
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

  return { state, quote, checkout, renew, setKept, setRenewal, resume, history };
}

export type BillingService = ReturnType<typeof createBillingService>;
