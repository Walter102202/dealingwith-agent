import {
  formatUsd,
  type Payment,
  PaymentSchema,
  type Quote,
  QuoteSchema,
} from '@dealingwith/contracts';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { Card } from '../components/Card.js';
import { Layout } from '../components/Layout.js';
import styles from './ReturnPages.module.css';

type State =
  | { kind: 'capturing' }
  | { kind: 'paid'; payment: Payment; quote: Quote | null }
  | { kind: 'failed'; message: string };

/** `/pay/return?token=<orderId>`: PayPal sends the buyer back here; we capture and show the receipt. */
export function PayReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get('token');
  const [state, setState] = useState<State>(
    orderId ? { kind: 'capturing' } : { kind: 'failed', message: 'This link has no PayPal order.' },
  );

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const payment = await api.post(routes.paypal.capture(orderId), {}, PaymentSchema);
        const quote = await api
          .get(routes.quotes.get(payment.quoteId, payment.quoteVersion), QuoteSchema)
          .catch(() => null);
        if (!cancelled) setState({ kind: 'paid', payment, quote });
      } catch (e) {
        if (!cancelled) setState({ kind: 'failed', message: errorMessage(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <Layout>
      <div className={styles.page}>
        {state.kind === 'capturing' ? (
          <Card title="Completing your payment">
            <p className="muted">Confirming with PayPal…</p>
          </Card>
        ) : null}
        {state.kind === 'failed' ? (
          <Card title="Payment not completed">
            <p className="error" role="alert">
              {state.message}
            </p>
            <p className={styles.links}>
              <Link to="/">Back to the storefront</Link>
            </p>
          </Card>
        ) : null}
        {state.kind === 'paid' ? <Receipt payment={state.payment} quote={state.quote} /> : null}
      </div>
    </Layout>
  );
}

function Receipt({ payment, quote }: { payment: Payment; quote: Quote | null }) {
  const projectId = quote?.projectId;
  return (
    <Card title="Payment received">
      <p className={styles.receipt}>
        {`Paid ${formatUsd(payment.amountCents)} · Quote v${payment.quoteVersion} · Capture id ${payment.paypalCaptureId ?? '—'}`}
      </p>
      <p className="muted">
        {projectId
          ? 'The extra is now part of your project scope. Your project page shows it under paid additionals.'
          : 'Thank you. The provider has your order and will be in touch.'}
      </p>
      <p className={styles.links}>
        <Link to={projectId ? `/portal/projects/${projectId}` : '/'} className={styles.primaryLink}>
          Back to project
        </Link>
      </p>
    </Card>
  );
}
