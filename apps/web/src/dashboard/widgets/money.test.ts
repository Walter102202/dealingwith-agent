import { describe, expect, it, vi } from 'vitest';
import { CENTS, centsOf, formatCents, formatValue, isCentsField } from './money.js';
import { column, summed } from './test-fields.js';

describe('isCentsField', () => {
  it('reads the cents context on a column', () => {
    expect(isCentsField(column('lines.amountCents', CENTS))).toBe(true);
    expect(isCentsField(column('lines.label'))).toBe(false);
  });

  it('reads it through an aggregation on that column', () => {
    expect(isCentsField(summed('lines.amountCents', CENTS))).toBe(true);
    expect(isCentsField(summed('lines.amountUsd'))).toBe(false);
  });
});

describe('formatCents', () => {
  it('formats integer cents with formatUsd', () => {
    expect(formatCents(8000)).toBe('US$80.00');
    expect(formatCents(123450)).toBe('US$1,234.50');
  });

  it('shows an empty sum as zero and a non-number as a dash', () => {
    expect(formatCents(null)).toBe('US$0.00');
    expect(formatCents(undefined)).toBe('US$0.00');
    expect(formatCents('80')).toBe('–');
  });

  it('rounds a fractional average for display', () => {
    expect(formatCents(1999.6)).toBe('US$20.00');
  });
});

describe('centsOf', () => {
  it('keeps integers and treats blanks as zero', () => {
    expect(centsOf(19000)).toBe(19000);
    expect(centsOf(null)).toBe(0);
    expect(centsOf(Number.NaN)).toBe(0);
  });
});

describe('formatValue', () => {
  it('formats cents itself and leaves other fields to Studio', () => {
    const studio = vi.fn(() => 'studio text');
    expect(formatValue(summed('payments.amountCents', CENTS), 6000, studio)).toBe('US$60.00');
    expect(studio).not.toHaveBeenCalled();
    expect(formatValue(column('requests.requestId'), 3, studio)).toBe('studio text');
  });
});
