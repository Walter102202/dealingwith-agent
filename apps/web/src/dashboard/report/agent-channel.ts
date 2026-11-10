import {
  agentBudget,
  at,
  countd,
  equals,
  field,
  isIn,
  kpiTile,
  LEGEND,
  LIVE,
  linesTable,
  type PageState,
  sum,
  titles,
} from './build.js';

const AGENT_REQUESTS = 'agent-requests';
const AGENT_QUOTED = 'agent-quoted';
const AGENT_PAID = 'agent-paid';
const REQUESTS_BY_CHANNEL = 'requests-by-channel';
const COLLECTED_BY_CHANNEL = 'collected-by-channel';
const BUDGET = 'agent-budget';
const AGENT_LINES = 'agent-lines';

/**
 * Agent channel: what came in through the MCP server (an AI agent) next to
 * the web, from request to quote to payment, and the mandate it spends from.
 */
export const AGENT_CHANNEL: PageState = {
  id: 'agent-channel',
  widgets: {
    [AGENT_REQUESTS]: kpiTile('Requests from agents', countd('requests.requestId'), {
      field: countd('requests.clientName'),
      one: 'client asking through an agent',
      many: 'clients asking through agents',
    }),
    [AGENT_QUOTED]: kpiTile('Quoted through agents', sum('quotes.totalCents'), {
      field: countd('quotes.quoteId'),
      one: 'live quote',
      many: 'live quotes',
    }),
    [AGENT_PAID]: kpiTile('Paid by agents', sum('payments.amountCents'), {
      field: countd('payments.quoteId'),
      one: 'quote paid within the mandate',
      many: 'quotes paid within the mandate',
    }),
    [REQUESTS_BY_CHANNEL]: {
      type: 'column-chart-stacked',
      format: {
        ...titles('Requests by channel', 'Requests received per day, web and agent'),
        crossFilter: 'filter',
        style: LEGEND,
      },
      dataMapping: {
        categoryKey: [field('requests.day')],
        valueKey: [{ id: 'requests.requestId', aggregation: 'count' }],
        legendKey: [field('requests.channel')],
      },
    },
    [COLLECTED_BY_CHANNEL]: {
      type: 'column-chart-stacked',
      format: {
        ...titles('Collected by channel', 'Captured payments by payment mode, US$'),
        crossFilter: 'filter',
        style: LEGEND,
      },
      dataMapping: {
        categoryKey: [field('payments.channel')],
        valueKey: [sum('payments.amountUsd')],
        legendKey: [field('payments.mode')],
      },
    },
    [BUDGET]: agentBudget(),
    [AGENT_LINES]: linesTable(
      'What agents asked for',
      'Priced lines on quotes requested through the MCP server.',
    ),
  },
  widgetLayout: {
    [AGENT_REQUESTS]: at(0, 0, 8, 8),
    [AGENT_QUOTED]: at(8, 0, 8, 8),
    [AGENT_PAID]: at(16, 0, 8, 8),
    [REQUESTS_BY_CHANNEL]: at(0, 8, 9, 18),
    [COLLECTED_BY_CHANNEL]: at(9, 8, 8, 18),
    [BUDGET]: at(17, 8, 7, 18),
    [AGENT_LINES]: at(0, 26, 24, 22),
  },
  filter: {
    widget: {
      [AGENT_REQUESTS]: [equals('requests.channel', 'mcp')],
      [AGENT_QUOTED]: [equals('quotes.channel', 'mcp'), isIn('quotes.status', LIVE)],
      [AGENT_PAID]: [equals('payments.mode', 'mandate'), equals('payments.status', 'captured')],
      [COLLECTED_BY_CHANNEL]: [equals('payments.status', 'captured')],
      [AGENT_LINES]: [
        equals('lines.channel', 'mcp'),
        equals('lines.kind', 'rule'),
        isIn('lines.quoteStatus', LIVE),
      ],
    },
  },
};
