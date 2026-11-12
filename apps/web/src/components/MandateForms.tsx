import { formatUsd, type Mandate, MandateSchema } from '@dealingwith/contracts';
import { type FormEvent, useId, useState } from 'react';
import { z } from 'zod';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { assign } from '../lib/navigation.js';
import { Button } from './Button.js';
import styles from './MandatePanel.module.css';

const FundResultSchema = z.object({ approvalUrl: z.url(), orderId: z.string() });

/** Dollars typed by a person → cents. Rejects anything that is not a positive amount. */
export function dollarsToCents(value: string): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

const dollars = (cents: number) => String(cents / 100);
const endOfDay = (day: string) => new Date(`${day}T23:59:59Z`).toISOString();

interface Limits {
  perPurchase: string;
  total: string;
  expires: string;
}

/** The three limits as typed, in cents; `null` with the reason when they are not usable. */
function parseLimits(values: Limits) {
  const perPurchaseLimitCents = dollarsToCents(values.perPurchase);
  const totalLimitCents = dollarsToCents(values.total);
  if (!perPurchaseLimitCents || !totalLimitCents || !values.expires)
    return { error: 'Enter positive amounts and an expiry date.' } as const;
  if (perPurchaseLimitCents > totalLimitCents)
    return { error: 'The per-purchase limit cannot be more than the total.' } as const;
  return {
    limits: { perPurchaseLimitCents, totalLimitCents, expiresAt: endOfDay(values.expires) },
  } as const;
}

function LimitsFields({ values, onChange }: { values: Limits; onChange: (v: Limits) => void }) {
  const id = useId();
  return (
    <div className={styles.grid}>
      <div>
        <label htmlFor={`${id}-per`}>Per purchase (USD)</label>
        <input
          id={`${id}-per`}
          type="number"
          min="1"
          step="0.01"
          value={values.perPurchase}
          onChange={(e) => onChange({ ...values, perPurchase: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${id}-total`}>Total (USD)</label>
        <input
          id={`${id}-total`}
          type="number"
          min="1"
          step="0.01"
          value={values.total}
          onChange={(e) => onChange({ ...values, total: e.target.value })}
        />
      </div>
      <div>
        <label htmlFor={`${id}-exp`}>Expires on</label>
        <input
          id={`${id}-exp`}
          type="date"
          value={values.expires}
          onChange={(e) => onChange({ ...values, expires: e.target.value })}
        />
      </div>
    </div>
  );
}

function FormError({ error }: { error: string | null }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}

/** A project without a mandate: the client proposes limits, which create a pending mandate. */
export function CreateMandateForm({
  projectId,
  onChange,
}: {
  projectId: string;
  onChange: () => Promise<void>;
}) {
  const [values, setValues] = useState<Limits>({
    perPurchase: '100',
    total: '300',
    expires: '2026-12-31',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseLimits(values);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(routes.mandates.create, { projectId, ...parsed.limits }, MandateSchema);
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
      <LimitsFields values={values} onChange={setValues} />
      <div>
        <Button type="submit" variant="primary" busy={busy}>
          Set budget
        </Button>
      </div>
      <FormError error={error} />
    </form>
  );
}

/** One sentence on what PayPal holds; `holdCents` is null while the total is not a valid amount. */
function holdSentence(holdCents: number | null, firstTime: boolean): string {
  const what = firstTime ? 'the total' : 'what is left of the total';
  const amount = holdCents !== null && holdCents > 0 ? `, ${formatUsd(holdCents)},` : '';
  return `PayPal holds ${what}${amount} and charges you only for what your agent spends.`;
}

/**
 * Assigns the agent budget, or re-authorizes it, in one step: the limits come
 * prefilled from the mandate and can be edited (saved first when they
 * changed), then PayPal authorizes what the agent can still spend, the total
 * minus what it already spent. For a budget assigned for the first time that
 * is the total (decision 2026-11-12-reset-unassigns-agent-budget).
 * `onSaved` refreshes the page when the limits were saved but PayPal could not
 * be reached, so the panel never shows limits the server no longer has.
 */
export function AssignBudgetForm({
  mandate,
  onCancel,
  onSaved,
}: {
  mandate: Mandate;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial: Limits = {
    perPurchase: dollars(mandate.perPurchaseLimitCents),
    total: dollars(mandate.totalLimitCents),
    expires: mandate.expiresAt.slice(0, 10),
  };
  const [values, setValues] = useState<Limits>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCents = dollarsToCents(values.total);
  const holdCents = totalCents === null ? null : totalCents - mandate.spentCents;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseLimits(values);
    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }
    const fundingAmountCents = parsed.limits.totalLimitCents - mandate.spentCents;
    if (fundingAmountCents <= 0) {
      setError(
        `The total must be more than what your agent already spent (${formatUsd(mandate.spentCents)}).`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    let saved = false;
    try {
      const expiryChanged = values.expires !== initial.expires;
      const changed =
        expiryChanged ||
        parsed.limits.perPurchaseLimitCents !== mandate.perPurchaseLimitCents ||
        parsed.limits.totalLimitCents !== mandate.totalLimitCents;
      if (changed) {
        await api.patch(
          routes.mandates.update(mandate.id),
          // An unchanged expiry goes back exactly as stored, never moved to the end of its day.
          {
            ...parsed.limits,
            expiresAt: expiryChanged ? parsed.limits.expiresAt : mandate.expiresAt,
          },
          MandateSchema,
        );
        saved = true;
      }
      const result = await api.post(
        routes.mandates.fund(mandate.id),
        { fundingAmountCents },
        FundResultSchema,
      );
      assign(result.approvalUrl);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      if (saved) await onSaved().catch(() => {});
    }
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <LimitsFields values={values} onChange={setValues} />
      <p className="muted small">{holdSentence(holdCents, mandate.spentCents === 0)}</p>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" busy={busy}>
          Continue to PayPal
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      <FormError error={error} />
    </form>
  );
}
