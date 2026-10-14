import type { PaymentIntent, PrismaClient } from "@ojo/db";
import { PRICING } from "@ojo/shared";
import type { BillingService } from "../billing/billing-service";
import type { CoreConfig } from "../types";
import { PAYMENT_METHODS, type PaymentMethod, type PaymentProvider, type ProviderPayment } from "./provider";

export type IntentStatus = "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";

/** A checkout as the interface sees it. */
export interface PaymentIntentDto {
  id: string;
  method: PaymentMethod;
  status: IntentStatus;
  amount: number;
  currency: string;
  /** Cases the subscription holds after paying. */
  targetCases: number;
  expiresAt: string;
  /** QR methods: what to draw as the QR code. */
  qrPayload: string | null;
  failureReason: string | null;
}

export type CreateIntentResult =
  | { ok: true; intent: PaymentIntentDto }
  | { ok: false; reason: "INVALID_CASES" | "LIMIT_REACHED" | "METHOD_UNAVAILABLE" | "NOTHING_TO_PAY" };

const OPEN: IntentStatus[] = ["PENDING", "PROCESSING"];

export function createPaymentService(deps: {
  prisma: PrismaClient;
  billing: BillingService;
  providers: PaymentProvider[];
  config: CoreConfig["payments"];
  now: () => Date;
}) {
  const { prisma, billing, providers, config, now } = deps;

  const providerOf = (method: string) => providers.find((item) => item.methods.includes(method as PaymentMethod));

  /** Methods a customer can pick right now (the first provider offering a method serves it). */
  function methods(): PaymentMethod[] {
    return PAYMENT_METHODS.filter((method) => providerOf(method) !== undefined);
  }

  async function toDto(row: PaymentIntent, payment?: ProviderPayment): Promise<PaymentIntentDto> {
    let qr: string | null = null;
    if (row.method === "mercadopago_qr" && row.providerRef && OPEN.includes(row.status as IntentStatus)) {
      const provider = providers.find((item) => item.id === row.provider);
      qr = (payment ?? (await provider?.get(row.providerRef)))?.qrPayload ?? null;
    }
    return {
      id: row.id,
      method: row.method as PaymentMethod,
      status: row.status as IntentStatus,
      amount: row.amount,
      currency: row.currency,
      targetCases: row.targetCases,
      expiresAt: row.expiresAt.toISOString(),
      qrPayload: qr,
      failureReason: row.failureReason,
    };
  }

  /**
   * Opens a checkout for `targetCases` cases in total. The amount is fixed here; whatever the
   * provider later reports, the purchase is applied once and at that amount.
   */
  async function create(
    userId: string,
    input: { cases: number; method: string },
  ): Promise<CreateIntentResult> {
    const provider = providerOf(input.method);
    if (!provider) return { ok: false, reason: "METHOD_UNAVAILABLE" };
    const method = input.method as PaymentMethod;
    const priced = await billing.quote(userId, input.cases);
    if (!priced.ok) return { ok: false, reason: priced.reason };
    if (priced.quote.addCases === 0 || priced.quote.amount <= 0) return { ok: false, reason: "NOTHING_TO_PAY" };

    // one open checkout at a time: an older unpaid one is given up
    const stale = await prisma.paymentIntent.findMany({ where: { userId, status: { in: OPEN } } });
    for (const old of stale) await cancelRow(old);

    const row = await prisma.paymentIntent.create({
      data: {
        userId,
        method,
        provider: provider.id,
        amount: priced.quote.amount,
        currency: priced.quote.currency ?? PRICING.currency,
        targetCases: input.cases,
        expiresAt: new Date(now().getTime() + config.intentTtlMinutes * 60_000),
      },
    });
    const payment = await provider.create({
      intentId: row.id,
      userId,
      method,
      amount: row.amount,
      currency: row.currency,
      description: `Ojo de Halcón: ${input.cases}`,
    });
    const updated = await prisma.paymentIntent.update({ where: { id: row.id }, data: { providerRef: payment.providerRef } });
    return { ok: true, intent: await toDto(updated, payment) };
  }

  async function cancelRow(row: PaymentIntent): Promise<void> {
    const provider = providers.find((item) => item.id === row.provider);
    if (row.providerRef) await provider?.cancel?.(row.providerRef);
    await prisma.paymentIntent.updateMany({
      where: { id: row.id, status: { in: OPEN } },
      data: { status: "CANCELLED", completedAt: now() },
    });
  }

  /** Applies the purchase once: only the call that wins the status change does it. */
  async function settle(row: PaymentIntent): Promise<void> {
    const won = await prisma.paymentIntent.updateMany({
      where: { id: row.id, status: { in: OPEN } },
      data: { status: "SUCCEEDED", completedAt: now() },
    });
    if (won.count !== 1) return;
    const applied = await billing.checkout(row.userId, row.targetCases, {
      provider: row.provider,
      method: row.method,
      intentId: row.id,
      amount: row.amount,
    });
    if (!applied.ok) {
      // paid, but the account changed meanwhile so that the purchase no longer fits: needs a human
      await prisma.paymentIntent.update({
        where: { id: row.id },
        data: { status: "FAILED", failureReason: "cannot_apply" },
      });
    }
  }

  /** Asks the provider, moves the checkout forward and returns it. Safe to call as often as needed. */
  async function refresh(row: PaymentIntent): Promise<PaymentIntent> {
    if (!OPEN.includes(row.status as IntentStatus)) return row;
    const provider = providers.find((item) => item.id === row.provider);
    if (row.expiresAt <= now()) {
      await cancelRow(row);
      await prisma.paymentIntent.updateMany({ where: { id: row.id, status: "CANCELLED" }, data: { status: "EXPIRED" } });
    } else if (provider && row.providerRef) {
      const payment = await provider.get(row.providerRef);
      if (payment.status === "SUCCEEDED") await settle(row);
      else if (payment.status === "FAILED") {
        await prisma.paymentIntent.updateMany({
          where: { id: row.id, status: { in: OPEN } },
          data: { status: "FAILED", failureReason: payment.failureReason ?? "failed", completedAt: now() },
        });
      } else if (payment.status !== row.status) {
        await prisma.paymentIntent.updateMany({
          where: { id: row.id, status: { in: OPEN } },
          data: { status: payment.status },
        });
      }
    }
    return prisma.paymentIntent.findUniqueOrThrow({ where: { id: row.id } });
  }

  async function owned(userId: string, id: string): Promise<PaymentIntent | null> {
    return prisma.paymentIntent.findFirst({ where: { id, userId } });
  }

  async function get(userId: string, id: string): Promise<PaymentIntentDto | null> {
    const row = await owned(userId, id);
    return row ? toDto(await refresh(row)) : null;
  }

  /** Card form submitted: `token` comes from the provider's own form, never a card number. */
  async function submitCard(userId: string, id: string, token: string): Promise<PaymentIntentDto | null> {
    const row = await owned(userId, id);
    if (!row) return null;
    const provider = providers.find((item) => item.id === row.provider);
    if (row.method !== "card" || !provider?.submitCard || !OPEN.includes(row.status as IntentStatus)) {
      return toDto(await refresh(row));
    }
    const payment = await provider.submitCard({ providerRef: row.providerRef ?? "", token });
    await prisma.paymentIntent.update({
      where: { id: row.id },
      data: { providerRef: payment.providerRef, status: payment.status === "FAILED" ? "PROCESSING" : payment.status },
    });
    return toDto(await refresh((await owned(userId, id))!));
  }

  async function cancel(userId: string, id: string): Promise<PaymentIntentDto | null> {
    const row = await owned(userId, id);
    if (!row) return null;
    await cancelRow(row);
    return toDto((await owned(userId, id))!);
  }

  /**
   * Webhook entry point: a provider tells that a payment changed. The answer is never trusted:
   * the state is read back from the provider before anything is applied.
   */
  async function onProviderEvent(providerId: string, providerRef: string): Promise<void> {
    const row = await prisma.paymentIntent.findFirst({ where: { provider: providerId, providerRef } });
    if (row) await refresh(row);
  }

  return { methods, create, get, submitCard, cancel, onProviderEvent };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
