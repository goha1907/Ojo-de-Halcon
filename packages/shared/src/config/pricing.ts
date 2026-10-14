/**
 * Subscription price. Placeholder values until the pricing model is final; change here
 * only. Amounts are whole units of `currency`.
 */
export const PRICING = {
  currency: "ARS",
  /** Price of a subscription holding 1, 2, 3 ... cases (one list entry per case count). */
  ladder: [5000, 9000, 12000, 14000],
  /** Every case beyond the ladder adds this much. */
  extraCase: 1000,
} as const;
