import { NextResponse } from "next/server";

/**
 * Where a real provider reports payments (Mercado Pago notifications, an acquirer's callbacks).
 * To connect one: verify the provider's signature of the request here, take the payment id from
 * it and call `getCore().payments.onProviderEvent(providerId, providerRef)`: the state is read
 * back from the provider and the purchase is applied once, exactly as when the window polls.
 */
export async function POST() {
  return NextResponse.json({ error: "NOT_IMPLEMENTED" }, { status: 501 });
}
