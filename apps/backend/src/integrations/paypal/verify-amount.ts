import { parsePaypalAmount } from '@dealingwith/contracts';
import { AppError } from '../../lib/errors.js';
/** Validate PayPal decimal money only at the integration boundary. */
export function verifyCaptureAmount(value: unknown, expectedCents: number): void {
  const amount =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  let cents: number | undefined;
  if (amount.currency_code === 'USD' && typeof amount.value === 'string') {
    try {
      cents = parsePaypalAmount(amount.value);
    } catch {
      /* Invalid decimal amounts fail below. */
    }
  }
  if (cents !== expectedCents)
    throw new AppError('payment_mismatch', 'PayPal amount or currency differs from the quote', {
      status: 409,
    });
}
