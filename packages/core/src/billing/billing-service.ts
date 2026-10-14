import type { PrismaClient } from "@ojo/db";
import { APP_CONFIG, PRICING, periodPrice, quoteCheckout } from "@ojo/shared";

const DAY_MS = 86_400_000;
const PROVIDER = "stub";

export interface QuoteDto {
  mode: "new_period" | "prorated";
  amount: number;
  currency: string;
  periodEnd: string;
  seatsAfter: number;
  addSeats: number;
}

export interface BillingStateDto {
  seats: number;
  /** Free slots: paid seats minus relatives already added. */
  freeSeats: number;
  currency: string;
  perUser: number;
  /** Price of the next full period at the current number of seats. */
  nextPeriodPrice: number;
}

export interface PaymentDto {
  id: string;
  amount: number;
  currency: string;
  kind: string;
  seatsDelta: number;
  createdAt: string;
}

export type CheckoutResult =
  | { ok: true; quote: QuoteDto }
  | { ok: false; reason: "INVALID_SEATS" | "LIMIT_REACHED" };

export type ReduceResult =
  | { ok: true; seats: number }
  | { ok: false; reason: "INVALID_SEATS" | "PEOPLE_MISMATCH" };

function toQuoteDto(quote: ReturnType<typeof quoteCheckout>): QuoteDto {
  return { ...quote, periodEnd: quote.periodEnd.toISOString() };
}

export function createBillingService(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  async function load(userId: string) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionUntil: true, seats: true, _count: { select: { people: true } } },
    });
  }

  async function state(userId: string): Promise<BillingStateDto> {
    const user = await load(userId);
    return {
      seats: user.seats,
      freeSeats: Math.max(0, user.seats - user._count.people),
      currency: PRICING.currency,
      perUser: PRICING.perUserPerPeriod,
      nextPeriodPrice: periodPrice(user.seats),
    };
  }

  /** Price of buying `addSeats` more slots (0 = just start / renew the period). */
  async function quote(userId: string, addSeats: number): Promise<CheckoutResult> {
    if (!Number.isInteger(addSeats) || addSeats < 0) return { ok: false, reason: "INVALID_SEATS" };
    const user = await load(userId);
    if (user.seats + addSeats > APP_CONFIG.limits.maxPeople) return { ok: false, reason: "LIMIT_REACHED" };
    return {
      ok: true,
      quote: toQuoteDto(
        quoteCheckout({
          subscriptionUntil: user.subscriptionUntil,
          seats: user.seats,
          addSeats,
          now: now(),
        }),
      ),
    };
  }

  /**
   * Pays for slots (and starts the period when none is running). Called by the
   * payment provider's confirmation; the stub calls it directly. Seats exist
   * only after this succeeds, so nothing is added before payment.
   */
  async function checkout(userId: string, addSeats: number): Promise<CheckoutResult> {
    const priced = await quote(userId, addSeats);
    if (!priced.ok) return priced;
    const { quote: q } = priced;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { subscriptionUntil: new Date(q.periodEnd), seats: q.seatsAfter },
      }),
      prisma.payment.create({
        data: {
          userId,
          amount: q.amount,
          currency: q.currency,
          kind: q.mode === "new_period" ? "subscription" : "seats",
          seatsDelta: q.addSeats,
          provider: PROVIDER,
        },
      }),
    ]);
    return priced;
  }

  /** Early renewal: one more full period from the current end (or from now). */
  async function renew(userId: string): Promise<QuoteDto> {
    const user = await load(userId);
    const from =
      user.subscriptionUntil && user.subscriptionUntil > now() ? user.subscriptionUntil : now();
    const until = new Date(from.getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS);
    const amount = periodPrice(user.seats);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { subscriptionUntil: until } }),
      prisma.payment.create({
        data: {
          userId,
          amount,
          currency: PRICING.currency,
          kind: "renewal",
          seatsDelta: 0,
          provider: PROVIDER,
        },
      }),
    ]);
    return {
      mode: "new_period",
      amount,
      currency: PRICING.currency,
      periodEnd: until.toISOString(),
      seatsAfter: user.seats,
      addSeats: 0,
    };
  }

  /**
   * Lowers the number of slots. The owner chooses which relatives go; they are
   * removed with their cases. No refund: the next period is simply cheaper.
   */
  async function reduceSeats(
    userId: string,
    input: { seats: number; removePersonIds: string[] },
  ): Promise<ReduceResult> {
    const user = await load(userId);
    if (!Number.isInteger(input.seats) || input.seats < 0 || input.seats > user.seats) {
      return { ok: false, reason: "INVALID_SEATS" };
    }
    const unique = [...new Set(input.removePersonIds)];
    const owned = await prisma.person.findMany({
      where: { userId, id: { in: unique } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (owned.length !== unique.length) return { ok: false, reason: "PEOPLE_MISMATCH" };
    // exactly the surplus must go: not fewer (no slot for them) nor more (they paid for them)
    const surplus = Math.max(0, user._count.people - input.seats);
    if (unique.length !== surplus) return { ok: false, reason: "PEOPLE_MISMATCH" };

    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { telegramId: true, locale: true },
    });
    const notices =
      owner.telegramId === null
        ? []
        : owned.map((person) =>
            prisma.telegramOutbox.create({
              data: {
                telegramId: owner.telegramId!,
                kind: "person_removed",
                locale: owner.locale,
                payload: { name: `${person.firstName} ${person.lastName}` },
              },
            }),
          );
    await prisma.$transaction([
      prisma.person.deleteMany({ where: { userId, id: { in: unique } } }),
      prisma.user.update({ where: { id: userId }, data: { seats: input.seats } }),
      ...notices,
    ]);
    return { ok: true, seats: input.seats };
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
      seatsDelta: row.seatsDelta,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  return { state, quote, checkout, renew, reduceSeats, history };
}

export type BillingService = ReturnType<typeof createBillingService>;
