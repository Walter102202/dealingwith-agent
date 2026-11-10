import type {
  AgFilterState,
  AgPageState,
  AgWidgetFieldReference,
  AgWidgetLayoutState,
  AgWidgetState,
} from 'ag-studio';
import type { DashboardRegistry } from '../widgets/types.js';

/**
 * Small builders for the hand-written report state (decision
 * 2026-11-07-ag-studio-definition-loading): field ids are `<sourceId>.<field>`,
 * the canvas is 24 columns of 16 px rows.
 */

export type PageState = AgPageState<DashboardRegistry>;
export type WidgetState = AgWidgetState<DashboardRegistry>;
export type FilterState = AgFilterState<DashboardRegistry>;

const TEXT_FONT = '"Geist", -apple-system, "Segoe UI", system-ui, sans-serif';

/** Position and size on the canvas, in columns and rows. */
export const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number) =>
  ({ xTrack, yTrack, xSpan, ySpan }) satisfies AgWidgetLayoutState;

export const field = (id: string): AgWidgetFieldReference => ({ id });
export const sum = (id: string): AgWidgetFieldReference => ({ id, aggregation: 'sum' });
export const countd = (id: string): AgWidgetFieldReference => ({ id, aggregation: 'countd' });

/** Widget title and subtitle, as Studio draws them above every widget. */
export const titles = (title: string, subtitle?: string) => ({
  title: { enabled: true, text: title },
  subtitle: subtitle ? { enabled: true, text: subtitle } : { enabled: false },
});

/** Chart style with the legend on: series are channels or payment modes, so name them. */
export const LEGEND = { theme: { common: { legend: { enabled: true } } } };

/** A KPI tile title: small and muted, so the number carries the tile (Collections board). */
export const kpiTitle = (text: string) => ({
  title: {
    enabled: true,
    text,
    color: '#5b665f',
    typography: { fontFamily: TEXT_FONT, fontSize: 14, fontWeight: 'normal' as const },
  },
  subtitle: { enabled: false },
});

export const equals = (id: string, value: string): FilterState => ({
  field: { id },
  model: { operator: 'equals', value },
});

export const isIn = (id: string, value: string[]): FilterState => ({
  field: { id },
  model: { operator: 'isIn', value },
});

/** Quote statuses whose lines are still waiting for the client's money. */
export const UNPAID = ['published', 'accepted'];
/** Every live status: superseded versions are left out so a quote counts once. */
export const LIVE = ['published', 'accepted', 'paid'];

/** The "Quotes and additionals" table over the `lines` source. */
export const linesTable = (title: string, subtitle: string): WidgetState => ({
  type: 'quotes-table',
  format: { ...titles(title, subtitle), crossFilter: 'filter', style: { totalRow: true } },
  dataMapping: {
    quote: [field('lines.quoteId')],
    client: [field('lines.clientName')],
    project: [field('lines.projectTitle')],
    line: [field('lines.label')],
    rule: [field('lines.ruleId')],
    channel: [field('lines.channel')],
    status: [field('lines.quoteStatus')],
    amount: [sum('lines.amountCents')],
  },
});

/** The agent budget meter over the `mandates` source; no other source relates to it. */
export const agentBudget = (): WidgetState => ({
  type: 'agent-budget',
  format: {
    ...titles('Agent budget', "What the client's AI agent may still spend"),
    crossFilter: 'none',
  },
  dataMapping: {
    spent: [sum('mandates.spentCents')],
    limit: [sum('mandates.totalLimitCents')],
    perPurchase: [{ id: 'mandates.perPurchaseLimitCents', aggregation: 'max' }],
    expires: [{ id: 'mandates.expiresOn', aggregation: 'last' }],
    status: [{ id: 'mandates.status', aggregation: 'first' }],
  },
});

/** A KPI tile: a cents total with a distinct count of quotes under it. */
export const kpiTile = (
  title: string,
  value: AgWidgetFieldReference,
  count?: { field: AgWidgetFieldReference; one: string; many: string },
): WidgetState => ({
  type: 'kpi-tile',
  format: {
    ...kpiTitle(title),
    crossFilter: 'filter',
    ...(count ? { style: { countOne: count.one, countMany: count.many } } : {}),
  },
  dataMapping: count ? { value: [value], count: [count.field] } : { value: [value] },
});
