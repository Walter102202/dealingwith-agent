import { AcceptQuoteResultSchema, type Payment } from '@dealingwith/contracts';
import { useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useAppConfig } from '../api/config.js';
import { routes } from '../api/routes.js';
import { assign } from '../lib/navigation.js';
import { Button } from './Button.js';
import styles from './PayWithPayPal.module.css';

interface PayWithPayPalProps {
  quoteId: string;
  version: number;
  amountCents: number;
  /**
   * Called when accept answers `paid` directly (zero total: the backend sends
   * no payment). A priced quote leaves the page for PayPal's approval page and
   * returns through `/pay/return`, which captures and shows the receipt.
   */
  onPaid: (payment?: Payment) => void;
}

/**
 * Accept and pay a quote version through one path in every PayPal mode: the
 * backend creates the order and answers with an approval link; the browser
 * goes there (PayPal's checkout in sandbox, our approve page in mock) and
 * comes back to `/pay/return`. Decision: docs/decisions/2026-11-08-single-approve-link-payment-path.md.
 */
export function PayWithPayPal({ quoteId, version, amountCents, onPaid }: PayWithPayPalProps) {
  const config = useAppConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(
        routes.quotes.accept(quoteId),
        { version },
        AcceptQuoteResultSchema,
      );
      if (result.status === 'denied') {
        throw new Error(result.message ?? 'This quote cannot be accepted.');
      }
      if (result.status === 'paid') {
        onPaid(result.payment);
        return;
      }
      if (result.approvalUrl) {
        assign(result.approvalUrl);
        return;
      }
      throw new Error('PayPal did not return an approval link.');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  if (config.error) {
    return (
      <p className="error" role="alert">
        {errorMessage(config.error)}
      </p>
    );
  }
  if (!config.data) return <p className="muted small">Loading payment options…</p>;

  const free = amountCents === 0;
  return (
    <div className={styles.wrap}>
      <Button variant="primary" busy={busy} onClick={() => void approve()}>
        {free ? 'Accept at no cost' : 'Pay with PayPal'}
      </Button>
      <p className="muted small">
        {free
          ? 'Nothing to pay: this is already covered by your scope.'
          : 'You approve the payment in PayPal; we capture it and bring you back here.'}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
