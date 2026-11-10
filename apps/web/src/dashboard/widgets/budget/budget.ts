import { centsOf } from '../money.js';
import type { BudgetMeterStyle } from '../types.js';

/** Which parts of the meter `format.style` turns on; every part defaults to on. */
export interface MeterParts {
  bar: boolean;
  perPurchase: boolean;
  status: boolean;
  expires: boolean;
}

export function meterParts(style: BudgetMeterStyle | undefined): MeterParts {
  return {
    bar: style?.showBar !== false,
    perPurchase: style?.showPerPurchase !== false,
    status: style?.showStatus !== false,
    expires: style?.showExpires !== false,
  };
}

/** What the agent budget meter shows. Every amount is integer cents. */
export interface BudgetMeter {
  spentCents: number;
  limitCents: number;
  /** What the agent can still spend: never below zero. */
  remainingCents: number;
  /** Share of the limit spent, 0 to 100, for the bar width and its label. */
  spentPercent: number;
  /** Spent more than the limit (a mandate cannot, but the meter does not hide it if it happens). */
  overLimit: boolean;
}

/**
 * Spent versus limit from the meter's query row. `null` when there is no
 * mandate yet: the query returns blanks, not zeros, for a source with no rows.
 */
export function budgetMeter(spent: unknown, limit: unknown): BudgetMeter | null {
  if (limit === null || limit === undefined) return null;
  const spentCents = Math.max(0, centsOf(spent));
  const limitCents = Math.max(0, centsOf(limit));
  const ratio = limitCents === 0 ? (spentCents > 0 ? 1 : 0) : spentCents / limitCents;
  return {
    spentCents,
    limitCents,
    remainingCents: Math.max(0, limitCents - spentCents),
    spentPercent: Math.min(100, Math.round(ratio * 100)),
    overLimit: spentCents > limitCents,
  };
}
