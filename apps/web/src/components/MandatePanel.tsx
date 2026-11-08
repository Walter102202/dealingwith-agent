import { formatUsd, type Mandate, MandateSchema, type Payment } from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { z } from 'zod';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { assign } from '../lib/navigation.js';
import { StatusBadge } from './Badge.js';
import { Button } from './Button.js';
import styles from './MandatePanel.module.css';
import { Money } from './Money.js';
import { formatDate } from './ScopeList.js';

interface MandatePanelProps {
  mandate: Mandate | null;
  projectId: string;
  /** The project's payments; the panel lists the ones the agent made. */
  payments: Payment[];
  onChange: () => Promise<void>;
}

const FundResultSchema = z.object({ approvalUrl: z.url(), orderId: z.string() });
const DEFAULT_FUNDING_CENTS = 200000;

/** Whole dollars typed by a person → cents. Rejects anything that is not a positive amount. */
function dollarsToCents(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function MandateForm({
  projectId,
  onChange,
}: {
  projectId: string;
  onChange: () => Promise<void>;
}) {
  const id = useId();
  const [perPurchase, setPerPurchase] = useState('100');
  const [total, setTotal] = useState('300');
  const [expires, setExpires] = useState('2026-12-31');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const perPurchaseLimitCents = dollarsToCents(perPurchase);
    const totalLimitCents = dollarsToCents(total);
    if (!perPurchaseLimitCents || !totalLimitCents || !expires) {
      setError('Enter positive amounts and an expiry date.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(
        routes.mandates.create,
        {
          projectId,
          perPurchaseLimitCents,
          totalLimitCents,
          expiresAt: new Date(`${expires}T23:59:59Z`).toISOString(),
        },
        MandateSchema,
      );
      await onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <p className="muted small">
        Set what your agent may spend without asking you. Payments above the per-purchase limit come
        back to you for approval.
      </p>
      <div className={styles.grid}>
        <div>
          <label htmlFor={`${id}-per`}>Per purchase (USD)</label>
          <input
            id={`${id}-per`}
            type="number"
            min="1"
            step="1"
            value={perPurchase}
            onChange={(e) => setPerPurchase(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-total`}>Total (USD)</label>
          <input
            id={`${id}-total`}
            type="number"
            min="1"
            step="1"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-exp`}>Expires on</label>
          <input
            id={`${id}-exp`}
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Button type="submit" variant="primary" busy={busy}>
          Set budget
        </Button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function FundForm({
  mandate,
  label,
  onDone,
}: {
  mandate: Mandate;
  label: string;
  onDone: () => void;
}) {
  const id = useId();
  const [amount, setAmount] = useState(String(DEFAULT_FUNDING_CENTS / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fund = async (event: FormEvent) => {
    event.preventDefault();
    const fundingAmountCents = dollarsToCents(amount);
    if (!fundingAmountCents) {
      setError('Enter a positive amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(
        routes.mandates.fund(mandate.id),
        { fundingAmountCents },
        FundResultSchema,
      );
      assign(result.approvalUrl);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void fund(e)}>
      <label htmlFor={id}>Amount to authorize in PayPal (USD)</label>
      <input
        id={id}
        type="number"
        min="1"
        step="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <p className="muted small">
        PayPal holds this amount; we capture only what your agent spends, purchase by purchase.
      </p>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" busy={busy}>
          {label}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Policy limits, PayPal backing with its headroom, and the payments the agent made. */
export function MandatePanel({ mandate, projectId, payments, onChange }: MandatePanelProps) {
  const [funding, setFunding] = useState(false);

  if (!mandate) return <MandateForm projectId={projectId} onChange={onChange} />;

  const backed = Boolean(mandate.funding.paypalAuthorizationId);
  const headroom = Math.max(
    0,
    mandate.funding.fundingAmountCents - mandate.funding.fundingCapturedCents,
  );
  const needsReauth = backed && headroom < mandate.perPurchaseLimitCents;
  const fundLabel = needsReauth ? 'Re-authorize' : 'Authorize with PayPal';
  const agentPayments = payments.filter((p) => p.mode === 'mandate');

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <span className={styles.spent}>
          Spent {formatUsd(mandate.spentCents)} of {formatUsd(mandate.totalLimitCents)}
        </span>
        <StatusBadge status={mandate.status} />
      </div>
      <progress
        className={styles.bar}
        max={mandate.totalLimitCents}
        value={mandate.spentCents}
        aria-label="Budget used"
      />
      <dl className={styles.facts}>
        <div>
          <dt>Per purchase</dt>
          <dd>
            <Money cents={mandate.perPurchaseLimitCents} />
          </dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{formatDate(mandate.expiresAt)}</dd>
        </div>
        {backed ? (
          <div>
            <dt>Backed by PayPal authorization</dt>
            <dd>
              <Money cents={headroom} /> <span className="muted small">left to capture</span>
            </dd>
          </div>
        ) : (
          <div>
            <dt>PayPal</dt>
            <dd className="muted">Not authorized yet</dd>
          </div>
        )}
      </dl>

      {funding ? (
        <FundForm mandate={mandate} label={fundLabel} onDone={() => setFunding(false)} />
      ) : (
        (!backed || needsReauth) && (
          <div>
            <Button
              variant={needsReauth ? 'secondary' : 'primary'}
              onClick={() => setFunding(true)}
            >
              {fundLabel}
            </Button>
          </div>
        )
      )}

      <section>
        <h3 className={styles.subheading}>Payments by your agent</h3>
        {agentPayments.length === 0 ? (
          <p className="muted small">None yet.</p>
        ) : (
          <ul className={styles.payments}>
            {agentPayments.map((p) => (
              <li key={p.id}>
                <span>
                  Quote v{p.quoteVersion} · {formatDate(p.createdAt)}
                </span>
                <span className={styles.amount}>
                  <Money cents={p.amountCents} /> <StatusBadge status={p.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
