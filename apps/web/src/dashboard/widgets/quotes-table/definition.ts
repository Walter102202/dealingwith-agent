import { shapeBuilder, widgetFormatShape } from '../format-shape.js';
import type { QuotesTableDefinition, QuotesTableStyle } from '../types.js';
import { QuotesTableComp } from './QuotesTable.js';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M2 6h12M6 6v7.5"/></svg>';

const dimension = (aiDescription: string, required = false) => ({
  type: 'field' as const,
  supportedRoles: ['category' as const],
  requires: { cardinality: 'many' as const },
  required,
  aiDescription,
});

/**
 * "Quotes and additionals": an AG Grid table of quote lines with status and
 * channel pills, amounts from cents, a total row, and cross-filtering both ways.
 */
export const quotesTableDefinition: QuotesTableDefinition = {
  id: 'quotes-table',
  label: 'Quotes and additionals',
  icon: ICON,
  dataMapping: {
    quote: dimension('Quote id: keeps lines apart and is what a row click selects.'),
    client: dimension('Client name.', true),
    project: dimension('Project title, shown under the client.'),
    line: dimension('Line label: what the client asked for.', true),
    rule: dimension('Pricing rule id of a priced line.'),
    channel: dimension('Request channel: web or mcp (an AI agent).'),
    status: dimension('Quote status.'),
    amount: {
      type: 'field',
      supportedRoles: ['numeric'],
      requires: { per: 'dataMapping.line', cardinality: 'one' },
      required: true,
      aiDescription: 'Line amount in integer cents.',
    },
  },
  form: (params) => {
    const form = params.createDefaults({
      dataMappingItems: [
        { key: 'client', label: 'Client' },
        { key: 'project', label: 'Project' },
        { key: 'line', label: 'Line' },
        { key: 'rule', label: 'Rule' },
        { key: 'channel', label: 'Channel' },
        { key: 'status', label: 'Status' },
        { key: 'amount', label: 'Amount' },
        { key: 'quote', label: 'Quote' },
      ],
      supportsCrossHighlight: true,
    });
    form.items[1]?.items.push(
      { type: 'checkbox', id: 'format.style.totalRow', label: 'Total row', defaultValue: true },
      {
        type: 'select',
        id: 'format.style.density',
        label: 'Density',
        defaultValue: 'comfortable',
        items: [
          { label: 'Comfortable', value: 'comfortable' },
          { label: 'Compact', value: 'compact' },
        ],
      },
    );
    return form;
  },
  formatShape: ({ api }) => {
    const s = shapeBuilder(api);
    return widgetFormatShape<QuotesTableStyle>(
      s,
      s.object({
        totalRow: s
          .boolean({ description: 'Show the pinned total row under the lines. Default true.' })
          .optional(),
        density: s
          .enum(['comfortable', 'compact'], {
            description:
              'Row height. "comfortable" (default) shows the project under the client; "compact" uses short single-line rows to fit more lines.',
          })
          .optional(),
      }),
    );
  },
  comp: QuotesTableComp,
  defaultSize: { width: 720, height: 360 },
  minSize: { width: 280, height: 220 },
  featureConfig: { crossFilter: { supportsHighlight: true } },
  ai: {
    description:
      'A table of quote lines: client, line, rule, channel and status pills, amount and a total.',
    usage: 'Use to list priced additionals, paid or unpaid. Map fields from the lines source.',
    configuration:
      '- format.style.totalRow hides or shows the total row; format.style.density "compact" fits more rows.',
  },
};
