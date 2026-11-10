import type { AgCoreDefaultRegistry, AgWidgetsConfig } from 'ag-studio';
import { createWidgets } from 'ag-studio-react';
import { budgetMeterDefinition } from './budget/definition.js';
import { kpiTileDefinition } from './kpi/definition.js';
import { quotesTableDefinition } from './quotes-table/definition.js';
import type { DashboardRegistry } from './types.js';

export type { DashboardRegistry } from './types.js';

/**
 * Studio's `widgets` property: the stock widgets plus the three DealingWith
 * widgets, listed first in the edit panel's widget menu. A function, so Studio
 * hands in its own defaults and nothing runs at import time.
 */
export function dashboardWidgets(
  defaults: AgWidgetsConfig<AgCoreDefaultRegistry>,
): AgWidgetsConfig<DashboardRegistry> {
  return createWidgets<DashboardRegistry>({
    additionalTypes: [quotesTableDefinition, budgetMeterDefinition, kpiTileDefinition],
    menu: [
      { label: 'DealingWith', widgetIds: ['quotes-table', 'agent-budget', 'kpi-tile'] },
      ...defaults.menu,
    ],
  });
}
