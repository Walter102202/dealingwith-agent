import type { Quote, ScopeClause } from '@dealingwith/contracts';
import { Badge } from './Badge.js';
import styles from './ScopeList.module.css';

interface ScopeListProps {
  clauses: ScopeClause[];
  /** Used to date paid additionals (`Added from quote v1 on 8 Nov 2026`). */
  quotes?: Quote[];
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/** The project's scope: what the contract covers, what was excluded, what paid quotes added. */
export function ScopeList({ clauses, quotes = [] }: ScopeListProps) {
  const contract = clauses.filter((c) => c.source.kind === 'contract');
  const paid = clauses.filter((c) => c.source.kind === 'quote');

  const paidAt = (clause: ScopeClause): string | null => {
    if (clause.source.kind !== 'quote') return null;
    const { quoteId, version } = clause.source;
    const quote = quotes.find((q) => q.id === quoteId && q.version === version);
    return quote?.paidAt ?? null;
  };

  return (
    <div className={styles.wrap}>
      <section>
        <h3 className={styles.heading}>Contracted scope</h3>
        <ul className={styles.list} aria-label="Contracted scope">
          {contract.map((clause) => (
            <li key={clause.id} className={clause.included ? styles.item : styles.excluded}>
              <span className={styles.id}>{clause.id}</span>
              <span className={styles.text}>{clause.text}</span>
              {clause.included ? null : <Badge tone="neutral">Excluded</Badge>}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className={styles.heading}>Paid additionals</h3>
        {paid.length === 0 ? (
          <p className="muted small">Nothing added yet. Paid quotes appear here.</p>
        ) : (
          <ul className={styles.list} aria-label="Paid additionals">
            {paid.map((clause) => {
              const when = paidAt(clause);
              const version = clause.source.kind === 'quote' ? clause.source.version : 0;
              return (
                <li key={clause.id} className={styles.item}>
                  <span className={styles.id}>{clause.id}</span>
                  <span className={styles.text}>
                    {clause.text}
                    <span className={styles.added}>
                      {when
                        ? `Added from quote v${version} on ${formatDate(when)}`
                        : `Added from quote v${version}`}
                    </span>
                  </span>
                  <Badge tone="positive">Included</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
