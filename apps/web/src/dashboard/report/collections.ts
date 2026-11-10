import {
  at,
  countd,
  equals,
  field,
  isIn,
  kpiTile,
  LEGEND,
  linesTable,
  type PageState,
  sum,
  titles,
  UNPAID,
} from './build.js';

const UNPAID_TOTAL = 'unpaid-total';
const COLLECTED = 'collected';
const AGENT_PAID = 'paid-by-agent';
const UNPAID_LINES = 'unpaid-additionals';
const UNPAID_BY_CHANNEL = 'unpaid-by-channel';

const unpaidLines = [equals('lines.kind', 'rule'), isIn('lines.quoteStatus', UNPAID)];

/**
 * Collections: what the clients still owe and what came in. Tiles, table and
 * donut over `lines` share the unpaid filter and cross-filter each other.
 */
export const COLLECTIONS: PageState = {
  id: 'collections',
  widgets: {
    [UNPAID_TOTAL]: kpiTile('Unpaid additionals', sum('lines.amountCents'), {
      field: countd('lines.quoteId'),
      one: 'quote waiting for the client',
      many: 'quotes waiting for the client',
    }),
    [COLLECTED]: kpiTile('Collected', sum('payments.amountCents'), {
      field: countd('payments.quoteId'),
      one: 'quote paid with PayPal',
      many: 'quotes paid with PayPal',
    }),
    [AGENT_PAID]: kpiTile("Paid by the client's agent", sum('payments.amountCents'), {
      field: countd('payments.quoteId'),
      one: 'quote paid within the mandate',
      many: 'quotes paid within the mandate',
    }),
    [UNPAID_LINES]: linesTable(
      'Unpaid additionals',
      'Priced lines on quotes that are published or accepted.',
    ),
    [UNPAID_BY_CHANNEL]: {
      type: 'donut-chart',
      format: {
        ...titles('Unpaid by channel', "Web versus the client's AI agent, US$"),
        crossFilter: 'filter',
        style: LEGEND,
      },
      dataMapping: {
        categoryKey: [field('lines.channel')],
        valueKey: [sum('lines.amountUsd')],
      },
    },
  },
  widgetLayout: {
    [UNPAID_TOTAL]: at(0, 0, 8, 8),
    [COLLECTED]: at(8, 0, 8, 8),
    [AGENT_PAID]: at(16, 0, 8, 8),
    [UNPAID_LINES]: at(0, 8, 16, 26),
    [UNPAID_BY_CHANNEL]: at(16, 8, 8, 26),
  },
  filter: {
    widget: {
      [UNPAID_TOTAL]: unpaidLines,
      [COLLECTED]: [equals('payments.status', 'captured')],
      [AGENT_PAID]: [equals('payments.mode', 'mandate'), equals('payments.status', 'captured')],
      [UNPAID_LINES]: unpaidLines,
      [UNPAID_BY_CHANNEL]: unpaidLines,
    },
  },
};
