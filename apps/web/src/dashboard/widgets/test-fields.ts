import type { AgWidgetField } from 'ag-studio';

/**
 * Minimal Studio fields for widget unit tests: only what the widget logic
 * reads (`key`, `fieldId`, `type`, `context`, `rootField`).
 */
export function column(id: string, context?: unknown): AgWidgetField {
  return { type: 'column', key: id, fieldId: id, context } as unknown as AgWidgetField;
}

export function summed(id: string, context?: unknown): AgWidgetField {
  return {
    type: 'implicitMeasure',
    key: `${id}:sum`,
    fieldId: id,
    aggregation: 'sum',
    rootField: column(id, context),
  } as unknown as AgWidgetField;
}
