/**
 * What a payment provider must do. The checkout flow (intents, the modal, polling, applying the
 * purchase once) talks only to this interface, so connecting a real provider (Mercado Pago,
 * a card acquirer) means writing one adapter here and registering it: nothing else changes.
 */

export const PAYMENT_METHODS = ["mercadopago_qr", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ProviderStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";

export interface ProviderPayment {
  /** The provider's id of the payment; stored with the checkout. */
  providerRef: string;
  status: ProviderStatus;
  failureReason?: string;
  /** QR methods: what the QR code encodes (a payment link or an EMV string). */
  qrPayload?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly methods: readonly PaymentMethod[];

  /** Opens a payment for a checkout whose amount is already fixed. */
  create(input: {
    intentId: string;
    userId: string;
    method: PaymentMethod;
    amount: number;
    currency: string;
    description: string;
  }): Promise<ProviderPayment>;

  /**
   * Card payments: pays with a token made by the provider's own form in the browser. Card
   * numbers never reach our server: only that token does.
   */
  submitCard?(input: { providerRef: string; token: string }): Promise<ProviderPayment>;

  /** Current state of a payment (polling, and the check done when a webhook arrives). */
  get(providerRef: string): Promise<ProviderPayment>;

  /** Gives up an unpaid payment. */
  cancel?(providerRef: string): Promise<void>;
}
