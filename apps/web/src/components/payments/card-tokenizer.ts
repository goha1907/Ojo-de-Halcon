/**
 * The one place that turns card fields into a payment token. In the test mode it makes a fake
 * token locally. With a real provider this is replaced by the provider's own SDK form
 * (e.g. Mercado Pago's CardForm): it sends the card straight to the provider and returns a
 * token, so the card number never passes through our server.
 */
export interface CardFields {
  number: string;
  holder: string;
  expiry: string;
  cvc: string;
}

export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** `MM/YY` that is a real month and not in the past. */
export function expiryValid(expiry: string, now: Date): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export async function tokenizeCard(fields: CardFields): Promise<string> {
  const declined = fields.number.replace(/\D/g, "").endsWith("0002");
  const random = Math.random().toString(36).slice(2, 10);
  return `stub_tok_${declined ? "declined" : "ok"}_${random}`;
}
