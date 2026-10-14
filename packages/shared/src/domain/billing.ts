import { APP_CONFIG } from "../config/app";
import { PRICING } from "../config/pricing";

const DAY_MS = 86_400_000;

/** Price of one period for a subscription holding `cases` tracked cases. */
export function casesPrice(cases: number): number {
  if (cases <= 0) return 0;
  const { ladder, extraCase } = PRICING;
  if (cases <= ladder.length) return ladder[cases - 1]!;
  return ladder[ladder.length - 1]! + (cases - ladder.length) * extraCase;
}

export interface PurchaseQuote {
  /** `new_period`: a period starts and is charged in full.
   *  `extra`: more cases are added to the running period; the renewal date stays. */
  mode: "new_period" | "extra";
  amount: number;
  currency: string;
  /** End of the paid period after the payment. */
  periodEnd: Date;
  /** Paid cases after the payment. */
  casesAfter: number;
  /** Cases this payment adds. */
  addCases: number;
}

/**
 * What a purchase costs. Without a running period one full period is charged for
 * `targetCases`. Inside a running period the added cases cost the difference of the
 * price ladder in full (no proration: they are tracked from now on) and the period
 * does not move.
 */
export function quotePurchase(input: {
  subscriptionUntil: Date | null;
  paidCases: number;
  targetCases: number;
  now: Date;
}): PurchaseQuote {
  const active = input.subscriptionUntil !== null && input.subscriptionUntil > input.now;
  if (!active) {
    return {
      mode: "new_period",
      amount: casesPrice(input.targetCases),
      currency: PRICING.currency,
      periodEnd: new Date(input.now.getTime() + APP_CONFIG.limits.subscriptionDays * DAY_MS),
      casesAfter: input.targetCases,
      addCases: input.targetCases,
    };
  }
  return {
    mode: "extra",
    amount: casesPrice(input.targetCases) - casesPrice(input.paidCases),
    currency: PRICING.currency,
    periodEnd: input.subscriptionUntil!,
    casesAfter: input.targetCases,
    addCases: input.targetCases - input.paidCases,
  };
}
