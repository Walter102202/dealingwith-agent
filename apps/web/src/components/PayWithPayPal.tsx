import { AcceptQuoteResultSchema, type Payment, PaymentSchema } from '@dealingwith/contracts';
import { lazy, Suspense, useCallback, useState } from 'react';
import { api, errorMessage } from '../api/client.js';
import { useAppConfig } from '../api/config.js';
import { routes } from '../api/routes.js';
import { assign } from '../lib/navigation.js';
import { Button } from './Button.js';
import styles from './PayWithPayPal.module.css';

const PayPalSandboxButtons = lazy(() => import('./PayPalSandboxButtons.js'));

interface PayWithPayPalProps {
  quoteId: string;
  version: number;
  amountCents: number;
  /**
   * Called when the quote is paid in place: after a sandbox capture, or when
   * accept answers `paid` directly (zero total: the backend sends no payment).
   * The mock flow returns through `/pay/return` instead.
   */
  onPaid: (payment?: Payment) => void;
}

/**
 * Accept and pay a quote version. Sandbox: the PayPal buttons. Mock: one
 * button that sends the browser to the mock approval page.
 */
export function PayWithPayPal({ quoteId, version, amountCents, onPaid }: PayWithPayPalProps) {
  const config = useAppConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async () => {
    const result = await api.post(
      routes.quotes.accept(quoteId),
      { version },
      AcceptQuoteResultSchema,
    );
    if (result.status === 'denied') {
      throw new Error(result.message ?? 'This quote cannot be accepted.');
    }
    return result;
  }, [quoteId, version]);

  const approveInMock = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await accept();
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

  const createOrder = async () => {
    setError(null);
    const result = await accept();
    const orderId = result.payment?.paypalOrderId;
    if (!orderId) throw new Error('PayPal did not return an order.');
    return orderId;
  };

  const capture = async (orderId: string) => {
    const payment = await api.post(routes.paypal.capture(orderId), {}, PaymentSchema);
    onPaid(payment);
  };

  if (config.error) {
    return (
      <p className="error" role="alert">
        {errorMessage(config.error)}
      </p>
    );
  }
  if (!config.data) return <p className="muted small">Loading payment options…</p>;

  const sandbox = config.data.paypalMode === 'sandbox' && config.data.paypalClientId;

  if (amountCents === 0) {
    return (
      <div className={styles.wrap}>
        <Button variant="primary" busy={busy} onClick={() => void approveInMock()}>
          Accept at no cost
        </Button>
        <p className="muted small">Nothing to pay: this is already covered by your scope.</p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {sandbox ? (
        <div className={styles.paypal} data-testid="paypal-buttons">
          <Suspense fallback={<p className="muted small">Loading PayPal…</p>}>
            <PayPalSandboxButtons
              clientId={sandbox}
              createOrder={createOrder}
              onApprove={capture}
              onError={(e) => setError(errorMessage(e))}
            />
          </Suspense>
        </div>
      ) : (
        <Button variant="primary" busy={busy} onClick={() => void approveInMock()}>
          Approve in mock PayPal
        </Button>
      )}
      <p className="muted small">You approve the payment in PayPal; we capture it.</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
