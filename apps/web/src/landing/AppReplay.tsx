import { formatUsd } from '@dealingwith/contracts';
import { useEffect, useState } from 'react';
import { QuoteCard } from '../components/QuoteCard.js';
import { DEMO_QUOTE, DEMO_REQUEST } from './demo-quote.js';
import styles from './Landing.module.css';
import { prefersReducedMotion, useInView } from './Reveal.js';

/** The beats of the replay, in order; each one is a state of the real page. */
const BEATS = ['empty', 'typing', 'sent', 'quoted', 'paying', 'paid'] as const;
type Beat = (typeof BEATS)[number];
const AT: Record<Beat, number> = {
  empty: 0,
  typing: 400,
  sent: 2900,
  quoted: 3700,
  paying: 6200,
  paid: 7400,
};
const FINAL: Beat = 'paid';

const CLAUSES = [
  { id: 'C1', text: 'Five views, including a per-branch view', excluded: false },
  { id: 'C2', text: 'Automations, scheduled emails and alerts', excluded: true },
  { id: 'C3', text: 'One data source: Shopify', excluded: false },
] as const;

function after(beat: Beat, than: Beat) {
  return BEATS.indexOf(beat) >= BEATS.indexOf(than);
}

/**
 * The project page, played: Mara types demo request 1, the quote card answers
 * (the real component, read-only), she pays with PayPal and clause C4 joins
 * the scope. Starts when it scrolls into view; reduced motion shows the end.
 */
export function AppReplay() {
  const { ref, inView } = useInView<HTMLDivElement>('0px 0px -20% 0px');
  const [beat, setBeat] = useState<Beat>('empty');
  const [typed, setTyped] = useState(0);
  const [run, setRun] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` is the Replay trigger; changing it restarts the timeline.
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setBeat(FINAL);
      setTyped(DEMO_REQUEST.length);
      return;
    }
    setBeat('empty');
    setTyped(0);
    const timers = BEATS.map((b) => window.setTimeout(() => setBeat(b), AT[b]));
    const span = AT.sent - AT.typing - 300;
    const step = span / DEMO_REQUEST.length;
    for (let i = 1; i <= DEMO_REQUEST.length; i++) {
      timers.push(window.setTimeout(() => setTyped(i), AT.typing + i * step));
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [inView, run]);

  const done = beat === FINAL;
  const quote = after(beat, 'paid') ? DEMO_QUOTE : { ...DEMO_QUOTE, status: 'published' as const };

  return (
    <div ref={ref} className={styles.window}>
      <div className={styles.chrome}>
        <span className={styles.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.url}>dealingwith.si/portal/projects/retail-kpi-dashboard</span>
        <button
          type="button"
          className={styles.replay}
          onClick={() => setRun((n) => n + 1)}
          disabled={!done}
        >
          Replay
        </button>
      </div>

      <div className={styles.app}>
        <aside className={styles.appSide}>
          <p className={styles.appEyebrow}>Lukas Retail GmbH</p>
          <h3 className={styles.appTitle}>Retail KPI dashboard</h3>
          <p className={styles.appLabel}>Contracted scope</p>
          <ul className={styles.clauses}>
            {CLAUSES.map((c) => (
              <li key={c.id} className={c.excluded ? styles.clauseOut : undefined}>
                <code>{c.id}</code>
                <span>{c.text}</span>
              </li>
            ))}
            {after(beat, 'paid') ? (
              <li className={styles.clauseNew}>
                <code>C4</code>
                <span>Weekly Monday summary email</span>
                <em>paid {formatUsd(8000)}</em>
              </li>
            ) : null}
          </ul>
          <div className={styles.mandateMini}>
            <span>Agent mandate M1</span>
            <strong>{formatUsd(10000)} per purchase</strong>
          </div>
        </aside>

        <div className={styles.appMain}>
          <div className={styles.composer} data-active={beat === 'typing' || undefined}>
            <span className={styles.composerLabel}>Describe what you need</span>
            <p className={styles.composerText}>
              {after(beat, 'sent') ? DEMO_REQUEST : DEMO_REQUEST.slice(0, typed)}
              {beat === 'typing' ? <span className={styles.caret} aria-hidden="true" /> : null}
            </p>
          </div>

          {beat === 'sent' ? (
            <p className={styles.thinking}>
              <span className={styles.spinner} aria-hidden="true" /> Reading the request against the
              contract…
            </p>
          ) : null}

          {after(beat, 'quoted') ? (
            <div className={styles.appQuote}>
              <QuoteCard quote={quote} preview />
              <div className={styles.payRow}>
                {after(beat, 'paid') ? (
                  <span className={styles.paidPill}>
                    <span className={styles.check} aria-hidden="true" />
                    {formatUsd(8000)} captured with PayPal
                  </span>
                ) : (
                  <span
                    className={styles.payPill}
                    data-pressed={beat === 'paying' || undefined}
                    aria-hidden="true"
                  >
                    Pay with PayPal
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
