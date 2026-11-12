import { formatUsd, type Mandate, type Payment } from '@dealingwith/contracts';
import { useState } from 'react';
import { StatusBadge } from './Badge.js';
import { Button } from './Button.js';
import { AssignBudgetForm, CreateMandateForm } from './MandateForms.js';
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

/** A mandate with limits but no PayPal authorization yet: the proposed budget. */
function ProposedBudget({ mandate, editing }: { mandate: Mandate; editing: boolean }) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.spent}>No budget assigned yet</span>
        <StatusBadge status={mandate.status} />
      </div>
      {editing ? null : (
        <>
          <dl className={styles.facts}>
            <div>
              <dt>Per purchase</dt>
              <dd>
                <Money cents={mandate.perPurchaseLimitCents} />
              </dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                <Money cents={mandate.totalLimitCents} />
              </dd>
            </div>
            <div>
              <dt>Expires</dt>
              <dd>{formatDate(mandate.expiresAt)}</dd>
            </div>
          </dl>
          <p className="muted small">
            Until you assign it, your agent asks you to approve every payment.
          </p>
        </>
      )}
    </>
  );
}

/** A funded (or closed) mandate: spend against the total, limits and the PayPal backing. */
function BudgetSummary({ mandate, headroom }: { mandate: Mandate; headroom: number }) {
  const backed = Boolean(mandate.funding.paypalAuthorizationId);
  return (
    <>
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
    </>
  );
}

/** Policy limits, PayPal backing with its headroom, and the payments the agent made. */
export function MandatePanel({ mandate, projectId, payments, onChange }: MandatePanelProps) {
  const [editing, setEditing] = useState(false);

  if (!mandate) return <CreateMandateForm projectId={projectId} onChange={onChange} />;

  const backed = Boolean(mandate.funding.paypalAuthorizationId);
  const canFund = mandate.status === 'pending' || mandate.status === 'active';
  const unassigned = canFund && !backed;
  const headroom = Math.max(
    0,
    mandate.funding.fundingAmountCents - mandate.funding.fundingCapturedCents,
  );
  const needsReauth = backed && headroom < mandate.perPurchaseLimitCents;
  const agentPayments = payments.filter((p) => p.mode === 'mandate');

  return (
    <div className={styles.panel}>
      {unassigned ? (
        <ProposedBudget mandate={mandate} editing={editing} />
      ) : (
        <BudgetSummary mandate={mandate} headroom={headroom} />
      )}

      {canFund && (unassigned || needsReauth) ? (
        editing ? (
          <AssignBudgetForm mandate={mandate} onCancel={() => setEditing(false)} />
        ) : (
          <div>
            <Button variant={unassigned ? 'primary' : 'secondary'} onClick={() => setEditing(true)}>
              {unassigned ? 'Assign a budget to your agent' : 'Re-authorize'}
            </Button>
          </div>
        )
      ) : !canFund ? (
        <p className="muted small">This mandate is {mandate.status}.</p>
      ) : null}

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
