import type { AgCrossFilterSelection, AgWidgetField } from 'ag-studio';
import { centsOf } from '../money.js';

/**
 * Pure logic of the "Quotes and additionals" table: which fields it queries,
 * how query rows become grid rows, and what a click cross-filters on.
 */

export type TableSlot = 'quote' | 'client' | 'project' | 'line' | 'rule' | 'channel' | 'status';
export type TableFields = Partial<Record<TableSlot | 'amount', AgWidgetField>>;
export type CompleteTableFields = TableFields &
  Required<Pick<TableFields, 'client' | 'line' | 'amount'>>;

/** Dimension slots in query and column order; `amount` is the one measure and comes last. */
export const DIMENSIONS: readonly TableSlot[] = [
  'quote',
  'client',
  'project',
  'line',
  'rule',
  'channel',
  'status',
];

export interface TableRow {
  id: string;
  values: Partial<Record<TableSlot, unknown>>;
  /** The line's amount as the query returned it: integer cents for a cents field. */
  amount: unknown;
  /** Slots whose value is part of the active cross-filter selection. */
  selected: TableSlot[];
  /** Outside the cross filter while the widget highlights rather than filters. */
  dimmed: boolean;
}

/** The first field mapped to each slot. */
export function mappedFields(
  dataMapping: Partial<Record<TableSlot | 'amount', AgWidgetField[]>>,
): TableFields {
  const fields: TableFields = {};
  for (const slot of [...DIMENSIONS, 'amount'] as const) {
    const field = dataMapping[slot]?.at(0);
    if (field) fields[slot] = field;
  }
  return fields;
}

export const isComplete = (fields: TableFields): fields is CompleteTableFields =>
  fields.client != null && fields.line != null && fields.amount != null;

/** Fields for `widgetApi.getData`: every mapped dimension, then the amount. */
export function queryFields(fields: CompleteTableFields): AgWidgetField[] {
  const dims = DIMENSIONS.map((slot) => fields[slot]).filter((f): f is AgWidgetField => f != null);
  return [...dims, fields.amount];
}

const keyOf = (row: Record<string, unknown>, fields: TableFields) =>
  JSON.stringify(
    DIMENSIONS.map((slot) => {
      const field = fields[slot];
      return field ? (row[field.key] ?? null) : null;
    }),
  );

/** Values selected per field id, from the widget's own cross-filter selections. */
export function selectedValues(
  selections: AgCrossFilterSelection[] | undefined,
): Map<string, Set<unknown>> {
  const byField = new Map<string, Set<unknown>>();
  for (const selection of selections ?? []) {
    if (selection.type !== 'value') continue;
    const set = byField.get(selection.field.fieldId) ?? new Set<unknown>();
    for (const value of selection.values) set.add(value);
    byField.set(selection.field.fieldId, set);
  }
  return byField;
}

/**
 * Query rows to grid rows. `crossFilterRows` is present only when the widget
 * highlights: rows missing from it are dimmed instead of removed.
 */
export function toTableRows(
  rows: Record<string, unknown>[],
  fields: CompleteTableFields,
  selections: Map<string, Set<unknown>>,
  crossFilterRows?: Record<string, unknown>[],
): TableRow[] {
  const kept = crossFilterRows ? new Set(crossFilterRows.map((r) => keyOf(r, fields))) : null;
  return rows.map((row) => {
    const id = keyOf(row, fields);
    const values: TableRow['values'] = {};
    const selected: TableSlot[] = [];
    for (const slot of DIMENSIONS) {
      const field = fields[slot];
      if (!field) continue;
      const value = row[field.key] ?? null;
      values[slot] = value;
      if (selections.get(field.fieldId)?.has(value)) selected.push(slot);
    }
    return {
      id,
      values,
      amount: row[fields.amount.key],
      selected,
      dimmed: kept ? !kept.has(id) : false,
    };
  });
}

/**
 * Sum of the amounts of the rows in view, in cents (display only: the lines are
 * already priced). Dimmed rows are outside the cross filter, so they do not count.
 */
export function totalCents(rows: TableRow[]): number {
  return rows.reduce((sum, row) => (row.dimmed ? sum : sum + centsOf(row.amount)), 0);
}

/**
 * What a click on a cell cross-filters on: the pill's own field for channel
 * and status, otherwise the row's quote (or its line when no quote is mapped).
 */
export function selectionTarget(
  slot: string | undefined,
  row: TableRow,
  fields: CompleteTableFields,
): { field: AgWidgetField; value: unknown } {
  if (slot === 'channel' || slot === 'status') {
    const pill = fields[slot];
    if (pill) return { field: pill, value: row.values[slot] ?? null };
  }
  if (fields.quote) return { field: fields.quote, value: row.values.quote ?? null };
  return { field: fields.line, value: row.values.line ?? null };
}
