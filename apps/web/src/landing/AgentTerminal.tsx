import { formatUsd } from '@dealingwith/contracts';
import { useEffect, useState } from 'react';
import styles from './Landing.module.css';
import { prefersReducedMotion, useInView } from './Reveal.js';

type Tone = 'ok' | 'warn' | 'info' | 'plain';
type Row =
  | { kind: 'prompt'; text: string }
  | { kind: 'tool'; name: string }
  | { kind: 'line'; text: string; amount?: string; note?: string; tone?: Tone }
  | { kind: 'status'; status: string; text: string; tone: Tone };

interface Scenario {
  id: string;
  chip: string;
  rows: Row[];
}

const usd = formatUsd;

/** Demo requests 2 to 5 as Mara's agent sees them over MCP (docs/demo-script.md). */
const SCENARIOS: Scenario[] = [
  {
    id: 'within',
    chip: '/within-budget',
    rows: [
      {
        kind: 'prompt',
        text: 'Request “Alert me by email when any branch’s daily sales drop more than 20%.” on the Retail KPI dashboard and accept it.',
      },
      { kind: 'tool', name: 'request_quote' },
      {
        kind: 'line',
        text: 'Daily sales drop alert (20%)',
        amount: usd(6000),
        note: 'rule S2.alert.v1',
      },
      { kind: 'line', text: 'Total', amount: usd(6000), note: 'delivery 1 day', tone: 'plain' },
      { kind: 'tool', name: 'accept_quote' },
      {
        kind: 'status',
        status: 'paid',
        text: `${usd(6000)} captured against the mandate’s PayPal authorization. Clause C5 added.`,
        tone: 'ok',
      },
    ],
  },
  {
    id: 'over',
    chip: '/over-limit',
    rows: [
      {
        kind: 'prompt',
        text: 'Request “Add our Amazon sales as a second source, no rush.” and accept it.',
      },
      { kind: 'tool', name: 'request_quote' },
      {
        kind: 'line',
        text: 'Data source integration: Amazon',
        amount: usd(15000),
        note: 'rule S3.base.v1',
      },
      {
        kind: 'line',
        text: 'Additional data source: Amazon',
        amount: usd(4000),
        note: 'rule S3.per_source.v1',
      },
      { kind: 'line', text: 'Total', amount: usd(19000), note: 'delivery 5 days', tone: 'plain' },
      { kind: 'tool', name: 'accept_quote' },
      {
        kind: 'status',
        status: 'approval_required',
        text: `Over the ${usd(10000)} per-purchase limit. Returns a PayPal approval link for Mara.`,
        tone: 'warn',
      },
    ],
  },
  {
    id: 'included',
    chip: '/already-paid',
    rows: [
      { kind: 'prompt', text: 'Request “Send the Monday summary to our regional managers too.”' },
      { kind: 'tool', name: 'request_quote' },
      {
        kind: 'line',
        text: 'Monday summary to regional managers',
        amount: usd(0),
        note: 'included · clause C4',
        tone: 'ok',
      },
      {
        kind: 'status',
        status: 'included',
        text: 'Covered by the extra paid in request 1. Nothing to charge.',
        tone: 'ok',
      },
    ],
  },
  {
    id: 'needs-info',
    chip: '/needs-info',
    rows: [
      { kind: 'prompt', text: 'Request “Make the dashboard load faster.”' },
      { kind: 'tool', name: 'request_quote' },
      {
        kind: 'line',
        text: 'Is the slowness caused by data volume or by the dashboard design?',
        tone: 'info',
      },
      {
        kind: 'line',
        text: 'More data means a data source integration; a redesign means a new dashboard build.',
        tone: 'plain',
      },
      {
        kind: 'status',
        status: 'needs_info',
        text: 'One question back. Nothing is priced or published until it is answered.',
        tone: 'info',
      },
    ],
  },
];

const STEP_MS = 520;

/** A Claude Code session against our MCP server, replayed; the chips pick the case. */
export function AgentTerminal() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const scenario = SCENARIOS[active] ?? SCENARIOS[0];
  const rows = scenario?.rows ?? [];

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setShown(rows.length);
      return;
    }
    setShown(0);
    const timers = rows.map((_, i) => window.setTimeout(() => setShown(i + 1), 250 + i * STEP_MS));
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [inView, rows]);

  return (
    <div ref={ref} className={styles.termWrap}>
      <div className={styles.chips} role="tablist" aria-label="Agent scenarios">
        <span className={styles.chipsLabel}>Try it</span>
        {SCENARIOS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={styles.chip}
            onClick={() => setActive(i)}
          >
            {s.chip}
          </button>
        ))}
      </div>
      <div className={styles.term}>
        <div className={styles.termBar}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>claude — dealingwith (MCP)</span>
        </div>
        <div className={styles.termBody} role="tabpanel" aria-live="polite">
          {rows.slice(0, shown).map((row, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are a fixed script per scenario.
            <TermRow key={`${scenario?.id}-${i}`} row={row} />
          ))}
          {shown < rows.length ? <span className={styles.termCaret} aria-hidden="true" /> : null}
        </div>
        <div className={styles.termFoot}>
          <span>mandate M1</span>
          <span>{usd(10000)} per purchase</span>
          <span>{usd(30000)} total</span>
          <span>PayPal sandbox</span>
        </div>
      </div>
    </div>
  );
}

function TermRow({ row }: { row: Row }) {
  if (row.kind === 'prompt') {
    return (
      <p className={`${styles.termRow} ${styles.termPrompt}`}>
        <span aria-hidden="true">›</span> {row.text}
      </p>
    );
  }
  if (row.kind === 'tool') {
    return (
      <p className={`${styles.termRow} ${styles.termTool}`}>
        <span className={styles.termDot} aria-hidden="true" />
        dealingwith · {row.name}
      </p>
    );
  }
  if (row.kind === 'status') {
    return (
      <p className={`${styles.termRow} ${styles.termStatus}`} data-tone={row.tone}>
        <code>{row.status}</code> {row.text}
      </p>
    );
  }
  return (
    <p className={`${styles.termRow} ${styles.termLine}`} data-tone={row.tone ?? 'plain'}>
      <span className={styles.termLabel}>{row.text}</span>
      {row.amount ? <span className={styles.termAmount}>{row.amount}</span> : null}
      {row.note ? <span className={styles.termNote}>{row.note}</span> : null}
    </p>
  );
}
