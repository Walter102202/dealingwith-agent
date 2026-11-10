import type { AgWidgetField } from 'ag-studio';

/**
 * A fake `widgetApi` for rendering a widget component in a unit test: one
 * query result, returned on every render as the same promise already marked
 * fulfilled (`status` and `value` are what React's `use` reads to take a
 * settled promise without suspending), and Studio's value formatter reduced
 * to `String`.
 */
export function fakeWidgetApi(rows: Record<string, unknown>[]) {
  const value = { results: { rows } };
  const result = Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  return {
    getData: () => result,
    formatFieldValue: (_field: AgWidgetField, raw: unknown) => String(raw ?? ''),
    getCrossFilterSelections: () => [],
    toggleCrossFilter: () => undefined,
  };
}
