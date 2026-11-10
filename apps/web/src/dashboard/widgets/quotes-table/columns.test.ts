import { describe, expect, it } from 'vitest';
import { CENTS } from '../money.js';
import { column, summed } from '../test-fields.js';
import { buildColumns, fitColumns } from './columns.js';

const fields = {
  client: column('lines.clientName'),
  line: column('lines.label'),
  rule: column('lines.ruleId'),
  channel: column('lines.channel'),
  status: column('lines.quoteStatus'),
  amount: summed('lines.amountCents', CENTS),
};
const format = () => '';

describe('fitColumns', () => {
  it('shows every column on a wide table and before the first layout', () => {
    expect(fitColumns(null, fields)).toEqual({ hidden: [], pinAmount: false });
    expect(fitColumns(1200, fields)).toEqual({ hidden: [], pinAmount: false });
  });

  it('drops columns in order until the rest fit, keeping the line and the amount', () => {
    expect(fitColumns(690, fields).hidden).toEqual(['rule']);
    expect(fitColumns(505, fields).hidden).toEqual(['rule', 'channel', 'client']);
    expect(fitColumns(320, fields)).toEqual({
      hidden: ['rule', 'channel', 'client', 'status'],
      pinAmount: false,
    });
  });

  it('pins the amount when even the line and the amount do not fit', () => {
    expect(fitColumns(250, fields).pinAmount).toBe(true);
  });

  it('counts only the mapped columns', () => {
    const { rule: _rule, channel: _channel, ...some } = fields;
    expect(fitColumns(690, some).hidden).toEqual([]);
    expect(fitColumns(520, some).hidden).toEqual(['client']);
  });
});

describe('buildColumns', () => {
  it('makes one column per mapped slot, in order, with the amount right-aligned', () => {
    const columns = buildColumns(fields, format);
    expect(columns.map((c) => c.colId)).toEqual([
      'client',
      'line',
      'rule',
      'channel',
      'status',
      'amount',
    ]);
    expect(columns.at(-1)?.type).toBe('rightAligned');
  });

  it('leaves out slots with no field', () => {
    const { rule: _rule, channel: _channel, ...some } = fields;
    expect(buildColumns(some, format).map((c) => c.colId)).toEqual([
      'client',
      'line',
      'status',
      'amount',
    ]);
  });

  it('hides and pins from the fit, and always sets both so the live grid follows', () => {
    const narrow = buildColumns(fields, format, fitColumns(250, fields));
    const by = (id: string) => narrow.find((c) => c.colId === id);
    expect(by('client')?.hide).toBe(true);
    expect(by('rule')?.hide).toBe(true);
    expect(by('channel')?.hide).toBe(true);
    expect(by('status')?.hide).toBe(true);
    expect(by('line')?.hide).toBe(false);
    expect(by('amount')).toMatchObject({ hide: false, pinned: 'right' });
    expect(buildColumns(fields, format).every((c) => c.hide === false && c.pinned === null)).toBe(
      true,
    );
  });
});
