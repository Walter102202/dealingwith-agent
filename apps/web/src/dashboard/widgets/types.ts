import type {
  AgDefaultWidgetDefinition,
  AgSortConfig,
  AgWidgetDataFormat,
  AgWidgetFieldReference,
} from 'ag-studio';
import type { AgRegistry, AgWidgetDefinition } from 'ag-studio-react';

/**
 * The state of the three DealingWith widgets, as saved in a report, and the
 * registry that tells Studio (and TypeScript) they exist next to the stock
 * widgets. Field slots are arrays of field references, like every Studio widget.
 */

type Fields = AgWidgetFieldReference[];

export interface QuotesTableStyle {
  /** Show a pinned total row under the lines. @default true */
  totalRow?: boolean;
}

export interface QuotesTableWidget {
  type: 'quotes-table';
  dataMapping: {
    client: Fields;
    project?: Fields;
    line: Fields;
    rule?: Fields;
    channel?: Fields;
    status?: Fields;
    amount: Fields;
    /** Identifies the quote a line belongs to: keeps lines apart and is what a row click selects. */
    quote?: Fields;
  };
  format?: AgWidgetDataFormat<QuotesTableStyle>;
  sort?: AgSortConfig[];
}

export interface BudgetMeterWidget {
  type: 'agent-budget';
  dataMapping: {
    spent: Fields;
    limit: Fields;
    perPurchase?: Fields;
    expires?: Fields;
    status?: Fields;
  };
  format?: AgWidgetDataFormat<Record<string, never>>;
}

export interface KpiTileStyle {
  /** Words after the count when it is 1, e.g. "quote waiting for the client". */
  countOne?: string;
  /** Words after the count otherwise, e.g. "quotes waiting for the client". */
  countMany?: string;
}

export interface KpiTileWidget {
  type: 'kpi-tile';
  dataMapping: {
    value: Fields;
    count?: Fields;
  };
  format?: AgWidgetDataFormat<KpiTileStyle>;
}

export type QuotesTableDefinition = AgWidgetDefinition<'quotes-table', QuotesTableWidget>;
export type BudgetMeterDefinition = AgWidgetDefinition<'agent-budget', BudgetMeterWidget>;
export type KpiTileDefinition = AgWidgetDefinition<'kpi-tile', KpiTileWidget>;

export interface DashboardRegistry extends AgRegistry {
  widgets: readonly (
    | AgDefaultWidgetDefinition
    | QuotesTableDefinition
    | BudgetMeterDefinition
    | KpiTileDefinition
  )[];
}
