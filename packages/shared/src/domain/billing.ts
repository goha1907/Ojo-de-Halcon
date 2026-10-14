import { APP_CONFIG } from "../config/app";
import { PRICING } from "../config/pricing";

const DAY_MS = 86_400_000;

/** Price of one full period: the owner plus `seats` relatives. */
export function periodPrice(seats: number): number {
  return PRICING.perUserPerPeriod * (1 + seats);
}

export interface CheckoutQuote {
  /** `new_period`: a period is started/renewed and charged in full.
   *  `prorated`: seats are added to the running period for the remaining days. */
  mode: "new_period" | "prorated";
  amount: number;
  currency: string;
  /** End of the paid period after the payment. */
  periodEnd: Date;
  seatsAfter: number;
  addSeats: number;
}

/**
 * What a purchase costs. Without an active subscription one full period is
 * charged for the owner and every seat. With one, only the new seats are
 * charged, in proportion to the days left, and the renewal date stays.
 */
export function quoteCheckout(input: {
  subscriptionUntil: Date | null;
  seats: number;
  addSeats: number;
  now: Date;
}): CheckoutQuote {
  const periodMs = APP_CONFIG.limits.subscriptionDays * DAY_MS;
  const seatsAfter = input.seats + input.addSeats;
  const active = input.subscriptionUntil !== null && input.subscriptionUntil > input.now;
  if (!active) {
    return {
      mode: "new_period",
      amount: periodPrice(seatsAfter),
      currency: PRICING.currency,
      periodEnd: new Date(input.now.getTime() + periodMs),
      seatsAfter,
      addSeats: input.addSeats,
    };
  }
  const remaining = input.subscriptionUntil!.getTime() - input.now.getTime();
  const fraction = Math.min(1, remaining / periodMs);
  const raw = PRICING.perUserPerPeriod * input.addSeats * fraction;
  return {
    mode: "prorated",
    // never free: at least one currency unit per purchase of seats
    amount: input.addSeats > 0 ? Math.max(1, Math.ceil(raw)) : 0,
    currency: PRICING.currency,
    periodEnd: input.subscriptionUntil!,
    seatsAfter,
    addSeats: input.addSeats,
  };
}
