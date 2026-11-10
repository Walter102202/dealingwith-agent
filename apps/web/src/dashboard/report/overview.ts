import {
  agentBudget,
  at,
  equals,
  field,
  isIn,
  LEGEND,
  LIVE,
  linesTable,
  type PageState,
  sum,
  titles,
} from './build.js';

const REVENUE = 'revenue-by-service';
const PIPELINE = 'quotes-pipeline';
const BUDGET = 'agent-budget';
const LINES = 'quotes-and-additionals';

/**
 * Overview: revenue, the quotes pipeline, the agent's budget and every priced
 * line. The charts and the table share the `lines` source, so a click on a
 * bar filters the table and a click in the table filters the charts.
 */
export const OVERVIEW: PageState = {
  id: 'overview',
  widgets: {
    [REVENUE]: {
      type: 'bar-chart-grouped',
      format: { ...titles('Revenue by service', 'Paid additionals, US$'), crossFilter: 'filter' },
      dataMapping: {
        categoryKey: [field('lines.serviceName')],
        valueKey: [sum('lines.amountUsd')],
      },
    },
    [PIPELINE]: {
      type: 'column-chart-stacked',
      format: {
        ...titles('Quotes pipeline', 'Quotes by status and channel'),
        crossFilter: 'filter',
        style: LEGEND,
      },
      dataMapping: {
        categoryKey: [field('lines.quoteStatus')],
        valueKey: [{ id: 'lines.quoteId', aggregation: 'countd' }],
        legendKey: [field('lines.channel')],
      },
    },
    [BUDGET]: agentBudget(),
    [LINES]: linesTable(
      'Quotes and additionals',
      'Every priced line. Click a bar, a status or a channel to filter the page.',
    ),
  },
  widgetLayout: {
    [REVENUE]: at(0, 0, 9, 18),
    [PIPELINE]: at(9, 0, 8, 18),
    [BUDGET]: at(17, 0, 7, 18),
    [LINES]: at(0, 18, 24, 24),
  },
  filter: {
    widget: {
      // Included lines are US$0.00 and would only add empty bars.
      [REVENUE]: [equals('lines.kind', 'rule'), equals('lines.quoteStatus', 'paid')],
      [PIPELINE]: [isIn('lines.quoteStatus', ['needs_info', ...LIVE])],
      [LINES]: [equals('lines.kind', 'rule'), isIn('lines.quoteStatus', LIVE)],
    },
  },
};
