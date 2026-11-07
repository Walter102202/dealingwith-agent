/**
 * Money helpers. Amounts are integer cents everywhere; PayPal's decimal
 * strings exist only at the PayPal boundary (decision 2026-11-07-integer-cents).
 */

function assertCents(cents: number): void {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`amount must be an integer number of cents, got ${cents}`);
  }
  if (cents < 0) {
    throw new RangeError(`amount must not be negative, got ${cents}`);
  }
}

/** `8000` → `"80.00"`, the format PayPal Orders v2 expects. */
export function formatPaypalAmount(cents: number): string {
  assertCents(cents);
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${dollars}.${String(remainder).padStart(2, '0')}`;
}

const PAYPAL_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;

/** `"190.00"` → `19000`. Accepts up to two decimals, rejects anything else. */
export function parsePaypalAmount(value: string): number {
  const match = PAYPAL_AMOUNT.exec(value.trim());
  const whole = match?.[1];
  if (whole === undefined) {
    throw new RangeError(`invalid PayPal amount: "${value}"`);
  }
  const fraction = (match?.[2] ?? '').padEnd(2, '0');
  return Number(whole) * 100 + Number(fraction);
}

/** `applyPercent(19000, 25)` → `4750`. Rounds half up to the cent. */
export function applyPercent(cents: number, percent: number): number {
  assertCents(cents);
  if (!Number.isFinite(percent) || percent < 0) {
    throw new RangeError(`percent must be a non-negative number, got ${percent}`);
  }
  return Math.round((cents * percent) / 100);
}
