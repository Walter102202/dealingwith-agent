import type { AgReportState } from 'ag-studio';

/**
 * The saved dashboard definition (spec 7.7): revenue by service, quotes
 * pipeline by status and channel, unpaid additionals, requests over time.
 *
 * Shape learned from `onStateUpdated` in the editor (decision
 * 2026-11-07-ag-studio-definition-loading): field ids are `<sourceId>.<field>`,
 * date components are `<field>.<unit>`, widget filters live under
 * `filter.widget[<widgetId>]`, the canvas is 24 columns of 16 px rows.
 */

const REVENUE = 'revenue-by-service';
const PIPELINE = 'quotes-pipeline';
const UNPAID = 'unpaid-additionals';
const REQUESTS = 'requests-over-time';

export const DASHBOARD_STATE: AgReportState = {
  version: '3.1.0',
  selectedPageId: 'overview',
  pages: [
    {
      id: 'overview',
      widgets: {
        [REVENUE]: {
          type: 'bar-chart-grouped',
          format: {
            title: { enabled: true, text: 'Revenue by service' },
            subtitle: { enabled: true, text: 'Paid quote lines, US$' },
          },
          dataMapping: {
            categoryKey: [{ id: 'lines.serviceName' }],
            valueKey: [{ id: 'lines.amountUsd', aggregation: 'sum' }],
          },
        },
        [PIPELINE]: {
          type: 'column-chart-stacked',
          format: {
            title: { enabled: true, text: 'Quotes pipeline' },
            subtitle: { enabled: true, text: 'Quotes by status and channel' },
          },
          dataMapping: {
            categoryKey: [{ id: 'quotes.status' }],
            valueKey: [{ id: 'quotes.quoteId', aggregation: 'count' }],
            legendKey: [{ id: 'quotes.channel' }],
          },
        },
        [UNPAID]: {
          type: 'grid',
          format: {
            title: { enabled: true, text: 'Unpaid additionals' },
            subtitle: {
              enabled: true,
              text: 'Priced lines on quotes that are published or accepted',
            },
            style: { columnAutoSize: true },
          },
          dataMapping: {
            cols: [
              { id: 'lines.clientName' },
              { id: 'lines.projectTitle' },
              { id: 'lines.label' },
              { id: 'lines.ruleId' },
              { id: 'lines.quoteStatus' },
              { id: 'lines.channel' },
              { id: 'lines.amountUsd', aggregation: 'sum' },
            ],
          },
        },
        [REQUESTS]: {
          type: 'line-chart',
          format: {
            title: { enabled: true, text: 'Requests over time' },
            subtitle: { enabled: true, text: 'Requests received per day' },
          },
          dataMapping: {
            categoryKey: [{ id: 'requests.day' }],
            valueKey: [{ id: 'requests.requestId', aggregation: 'count' }],
          },
        },
      },
      widgetLayout: {
        [REVENUE]: { xTrack: 0, yTrack: 0, xSpan: 12, ySpan: 20 },
        [PIPELINE]: { xTrack: 12, yTrack: 0, xSpan: 12, ySpan: 20 },
        [UNPAID]: { xTrack: 0, yTrack: 20, xSpan: 24, ySpan: 20 },
        [REQUESTS]: { xTrack: 0, yTrack: 40, xSpan: 24, ySpan: 18 },
      },
      filter: {
        widget: {
          [REVENUE]: [
            { field: { id: 'lines.quoteStatus' }, model: { operator: 'equals', value: 'paid' } },
          ],
          [UNPAID]: [
            { field: { id: 'lines.kind' }, model: { operator: 'equals', value: 'rule' } },
            {
              field: { id: 'lines.quoteStatus' },
              model: { operator: 'isIn', value: ['published', 'accepted'] },
            },
          ],
        },
      },
    },
  ],
};
