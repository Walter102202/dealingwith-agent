import { type Payment, type Quote, type QuoteLineItem, ruleRefLabel } from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { Badge, StatusBadge } from './Badge.js';
import { Button } from './Button.js';
import { Money } from './Money.js';
import { NeedsInfoForm } from './NeedsInfoForm.js';
import { PayWithPayPal } from './PayWithPayPal.js';
import styles from './QuoteCard.module.css';

interface QuoteCardProps {
  quote: Quote;
  /** Called when a payment completes without leaving the page (sandbox capture). */
  /** The quote was paid in place (sandbox capture or zero total); the backend sends no payment for a zero total. */
  onAccept: (payment?: Payment) => Promise<void> | void;
  /** Free-text adjustment; the page posts it as `answers.adjustment`. */
  onAdjust: (text: string) => Promise<void>;
  onAnswers: (answers: Record<string, string>) => Promise<void>;
}

export function deliveryLabel(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

function sourceLabel(line: QuoteLineItem): string {
  if (line.kind === 'included') return `Source: clause ${line.scopeRef}`;
  return `Rule ${ruleRefLabel(line.ruleRef)}`;
}

function Line({ line }: { line: QuoteLineItem }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <li className={styles.line}>
      <div className={styles.lineMain}>
        <span className={styles.label}>{line.label}</span>
        <span className={styles.amount}>
          {line.kind === 'included' ? <Badge tone="positive">Included</Badge> : null}
          {line.kind === 'rule' && line.quantity > 1 ? (
            <span className="muted small">
              {line.quantity} × <Money cents={line.unitAmountCents} />
            </span>
          ) : null}
          <Money cents={line.amountCents} />
        </span>
      </div>
      <p className={styles.rationale}>{line.rationale}</p>
      <button
        type="button"
        className={styles.why}
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
      >
        Why this line
      </button>
      {open ? (
        <p id={detailId} className={styles.source}>
          {sourceLabel(line)}
        </p>
      ) : null}
    </li>
  );
}

function AdjustForm({
  onAdjust,
  onClose,
}: {
  onAdjust: (t: string) => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Say what should change.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdjust(text.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };
  return (
    <form className={styles.adjust} onSubmit={(e) => void submit(e)}>
      <label htmlFor={id}>What should change?</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={2} />
      <div className={styles.actions}>
        <Button type="submit" variant="primary" busy={busy}>
          Send request
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
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

/**
 * The hero: a quote laid out like a document. Each line says what it is,
 * whether it is included or an extra, why, and what it cites.
 */
export function QuoteCard({ quote, onAccept, onAdjust, onAnswers }: QuoteCardProps) {
  const [adjusting, setAdjusting] = useState(false);
  const published = quote.status === 'published';
  const payable = published || quote.status === 'accepted';

  return (
    <article className={styles.card} aria-labelledby={`quote-${quote.id}-${quote.version}`}>
      <header className={styles.head}>
        <h2 id={`quote-${quote.id}-${quote.version}`} className={styles.title}>
          Quote v{quote.version}
        </h2>
        <StatusBadge status={quote.status} />
      </header>

      {quote.status === 'needs_info' ? (
        <>
          <p className={styles.explanation}>{quote.explanation}</p>
          <NeedsInfoForm items={quote.needsInfo} onSubmit={onAnswers} />
        </>
      ) : (
        <>
          <ul className={styles.lines}>
            {quote.lineItems.map((line) => (
              <Line key={`${line.kind}-${line.label}`} line={line} />
            ))}
          </ul>
          <dl className={styles.facts}>
            <div>
              <dt>Delivery</dt>
              <dd>{deliveryLabel(quote.deliveryDays)}</dd>
            </div>
            <div className={styles.totalRow}>
              <dt>Total</dt>
              <dd data-testid="quote-total">
                <Money cents={quote.totalCents} size="total" />
              </dd>
            </div>
          </dl>
          <p className={styles.explanation}>{quote.explanation}</p>
          {payable ? (
            <div className={styles.footer}>
              <div className={styles.pay}>
                <span className={styles.payLabel}>
                  {quote.totalCents === 0 ? 'Accept' : 'Accept and pay with PayPal'}
                </span>
                <PayWithPayPal
                  quoteId={quote.id}
                  version={quote.version}
                  amountCents={quote.totalCents}
                  onPaid={(payment) => void onAccept(payment)}
                />
              </div>
              {!published ? null : adjusting ? (
                <AdjustForm onAdjust={onAdjust} onClose={() => setAdjusting(false)} />
              ) : (
                <Button onClick={() => setAdjusting(true)}>Ask for an adjustment</Button>
              )}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
