import type { PaymentMethod, PaymentProvider, ProviderPayment } from "./provider";

/**
 * Test provider: no money moves. A payment "processes" for a few seconds and then succeeds. The
 * state lives in the payment id itself, so nothing is kept in memory and it survives restarts.
 *
 *   QR      `stub:qr:<createdMs>`            succeeds on its own (as if the QR was paid)
 *   card    `stub:card:<submittedMs>:<ok|declined>`  the card form was submitted
 *
 * In the test form a card number ending in 0002 is declined; any other number is accepted.
 */
export function createStubProvider(options: { processingSeconds: number; now: () => Date }): PaymentProvider {
  const delayMs = options.processingSeconds * 1000;

  function parse(providerRef: string): ProviderPayment {
    const [, kind, stamp, outcome] = providerRef.split(":");
    const started = Number(stamp);
    const elapsed = options.now().getTime() - started;
    if (kind === "qr") {
      return {
        providerRef,
        status: elapsed >= delayMs ? "SUCCEEDED" : "PENDING",
        qrPayload: `ojo-stub://pay/${providerRef}`,
      };
    }
    if (kind === "card-open") return { providerRef, status: "PENDING" };
    if (elapsed < delayMs) return { providerRef, status: "PROCESSING" };
    return outcome === "declined"
      ? { providerRef, status: "FAILED", failureReason: "card_declined" }
      : { providerRef, status: "SUCCEEDED" };
  }

  return {
    id: "stub",
    methods: ["mercadopago_qr", "card"] satisfies PaymentMethod[],

    async create({ method }) {
      const stamp = options.now().getTime();
      return parse(method === "mercadopago_qr" ? `stub:qr:${stamp}` : `stub:card-open:${stamp}`);
    },

    async submitCard({ token }) {
      const outcome = token.includes("declined") ? "declined" : "ok";
      return parse(`stub:card:${options.now().getTime()}:${outcome}`);
    },

    async get(providerRef) {
      return parse(providerRef);
    },

    async cancel() {
      // nothing is held by the stub
    },
  };
}
