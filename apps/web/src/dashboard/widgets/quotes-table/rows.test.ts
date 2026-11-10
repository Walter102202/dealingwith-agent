import type { AgCrossFilterSelection } from 'ag-studio';
import { describe, expect, it } from 'vitest';
import { CENTS } from '../money.js';
import { column, summed } from '../test-fields.js';
import {
  type CompleteTableFields,
  isComplete,
  mappedFields,
  queryFields,
  selectedValues,
  selectionTarget,
  toTableRows,
  totalCents,
} from './rows.js';

const quote = column('lines.quoteId');
const channel = column('lines.channel');
const status = column('lines.quoteStatus');
const fields = {
  quote,
  client: column('lines.clientName'),
  line: column('lines.label'),
  channel,
  status,
  amount: summed('lines.amountCents', CENTS),
} satisfies CompleteTableFields;

const queryRow = (quote: string, line: string, channel: string, status: string, cents: number) => ({
  'lines.quoteId': quote,
  'lines.clientName': 'Lukas Retail GmbH',
  'lines.label': line,
  'lines.channel': channel,
  'lines.quoteStatus': status,
  'lines.amountCents:sum': cents,
});

const ROWS = [
  queryRow('q1', 'Weekly Monday summary email', 'web', 'paid', 8000),
  queryRow('q2', 'Second data source', 'web', 'published', 19000),
  queryRow('q3', 'Threshold alert email', 'mcp', 'published', 6000),
];

describe('mappedFields and queryFields', () => {
  it('takes the first field of each slot and queries dimensions before the amount', () => {
    const mapped = mappedFields({
      client: [fields.client],
      line: [fields.line],
      amount: [fields.amount],
      status: [fields.status],
    });
    expect(isComplete(mapped)).toBe(true);
    if (!isComplete(mapped)) return;
    expect(queryFields(mapped).map((f) => f.key)).toEqual([
      'lines.clientName',
      'lines.label',
      'lines.quoteStatus',
      'lines.amountCents:sum',
    ]);
  });

  it('is incomplete without a client, a line and an amount', () => {
    expect(isComplete(mappedFields({ client: [fields.client], line: [fields.line] }))).toBe(false);
  });
});

describe('toTableRows', () => {
  it('maps query rows to grid rows and keeps the cents', () => {
    const rows = toTableRows(ROWS, fields, new Map());
    expect(rows).toHaveLength(3);
    expect(rows[1]?.values).toMatchObject({ line: 'Second data source', status: 'published' });
    expect(rows[1]?.amount).toBe(19000);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });

  it('marks the slots that are part of the cross-filter selection', () => {
    const selections = selectedValues([
      { type: 'value', group: 0, field: fields.status, values: ['published'] },
    ] satisfies AgCrossFilterSelection[]);
    const rows = toTableRows(ROWS, fields, selections);
    expect(rows.map((r) => r.selected)).toEqual([[], ['status'], ['status']]);
  });

  it('dims the rows a highlight cross filter leaves out', () => {
    const rows = toTableRows(ROWS, fields, new Map(), [ROWS[2] ?? {}]);
    expect(rows.map((r) => r.dimmed)).toEqual([true, true, false]);
  });

  it('dims nothing while the widget filters instead of highlighting', () => {
    expect(toTableRows(ROWS, fields, new Map()).some((r) => r.dimmed)).toBe(false);
  });
});

describe('totalCents', () => {
  it('adds the line amounts in integer cents', () => {
    expect(totalCents(toTableRows(ROWS, fields, new Map()))).toBe(33000);
  });

  it('leaves out the rows a highlight cross filter dims', () => {
    expect(totalCents(toTableRows(ROWS, fields, new Map(), [ROWS[2] ?? {}]))).toBe(6000);
  });
});

describe('selectionTarget', () => {
  const [paid, , agent] = toTableRows(ROWS, fields, new Map());

  it('filters on the pill a click lands on', () => {
    expect(paid && selectionTarget('status', paid, fields)).toEqual({
      field: fields.status,
      value: 'paid',
    });
    expect(agent && selectionTarget('channel', agent, fields)).toEqual({
      field: fields.channel,
      value: 'mcp',
    });
  });

  it('filters on the quote for a click anywhere else on the row', () => {
    expect(agent && selectionTarget('line', agent, fields)).toEqual({
      field: fields.quote,
      value: 'q3',
    });
  });

  it('falls back to the line when no quote is mapped', () => {
    const { quote: _quote, ...noQuote } = fields;
    expect(agent && selectionTarget('amount', agent, noQuote)).toEqual({
      field: fields.line,
      value: 'Threshold alert email',
    });
  });
});

describe('selectedValues', () => {
  it('groups value selections by field and ignores other kinds', () => {
    const byField = selectedValues([
      { type: 'value', group: 0, field: fields.channel, values: ['mcp'] },
      { type: 'range', group: 1, field: fields.amount, from: 0, to: 10 },
    ]);
    expect([...byField.keys()]).toEqual(['lines.channel']);
    expect(byField.get('lines.channel')?.has('mcp')).toBe(true);
  });
});
