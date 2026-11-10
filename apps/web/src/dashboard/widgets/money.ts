import { formatUsd } from '@dealingwith/contracts';
import type { AgWidgetField } from 'ag-studio';

/**
 * Money in the dashboard stays in integer cents until a widget renders it.
 * Cents fields are marked with this field `context` in `sources.ts`; Studio
 * carries it on the hydrated field and never reads it.
 */
export interface CentsContext {
  unit: 'cents';
}

export const CENTS: CentsContext = { unit: 'cents' };

const isCentsContext = (value: unknown): value is CentsContext =>
  typeof value === 'object' && value !== null && (value as { unit?: unknown }).unit === 'cents';

/** True when the field, or the column an aggregation such as `sum` reads, holds cents. */
export function isCentsField(field: AgWidgetField): boolean {
  if (isCentsContext(field.context)) return true;
  return field.type === 'implicitMeasure' && isCentsContext(field.rootField?.context);
}

/**
 * A cents value from a query (a sum of integer cents is an integer) as
 * `US$1,234.50`. A blank value is US$0.00, since an empty sum means nothing
 * yet. An average can be fractional; it is rounded for display only.
 */
export function formatCents(value: unknown): string {
  if (value === null || value === undefined) return formatUsd(0);
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
  const cents = Math.round(Math.abs(value));
  return value < 0 ? `−${formatUsd(cents)}` : formatUsd(cents);
}

/** Integer cents from a query value; anything blank or non-numeric is 0. */
export function centsOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0;
}

/** A field value as text: cents fields through `formatUsd`, the rest through Studio's formatter. */
export function formatValue(
  field: AgWidgetField,
  value: unknown,
  formatFieldValue: (field: AgWidgetField, value: unknown) => string,
): string {
  return isCentsField(field) ? formatCents(value) : formatFieldValue(field, value);
}
