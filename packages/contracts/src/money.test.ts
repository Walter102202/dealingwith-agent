import { describe, expect, test } from 'vitest';
import { applyPercent, formatPaypalAmount, formatUsd, parsePaypalAmount } from './money.js';

describe('formatPaypalAmount', () => {
  test('formats whole dollars with two decimals', () => {
    expect(formatPaypalAmount(8000)).toBe('80.00');
    expect(formatPaypalAmount(19000)).toBe('190.00');
  });

  test('keeps cents', () => {
    expect(formatPaypalAmount(4750)).toBe('47.50');
    expect(formatPaypalAmount(5)).toBe('0.05');
  });

  test('rejects non-integer or negative cents', () => {
    expect(() => formatPaypalAmount(10.5)).toThrow(/integer/);
    expect(() => formatPaypalAmount(-1)).toThrow(/negative/);
  });
});

describe('parsePaypalAmount', () => {
  test('parses PayPal decimal strings into cents', () => {
    expect(parsePaypalAmount('60.00')).toBe(6000);
    expect(parsePaypalAmount('190.00')).toBe(19000);
    expect(parsePaypalAmount('0.05')).toBe(5);
    expect(parsePaypalAmount('12')).toBe(1200);
    expect(parsePaypalAmount('12.5')).toBe(1250);
  });

  test('rejects malformed values', () => {
    expect(() => parsePaypalAmount('12.345')).toThrow();
    expect(() => parsePaypalAmount('abc')).toThrow();
    expect(() => parsePaypalAmount('-1.00')).toThrow();
  });
});

describe('applyPercent', () => {
  test('applies a percentage and rounds half up to the cent', () => {
    expect(applyPercent(19000, 25)).toBe(4750);
    expect(applyPercent(1, 50)).toBe(1); // 0.5 cents rounds up
    expect(applyPercent(3, 50)).toBe(2); // 1.5 cents rounds up
    expect(applyPercent(100, 0)).toBe(0);
  });
});

describe('formatUsd', () => {
  test('formats cents as US dollars with grouping and two decimals', () => {
    expect(formatUsd(8000)).toBe('US$80.00');
    expect(formatUsd(123450)).toBe('US$1,234.50');
    expect(formatUsd(0)).toBe('US$0.00');
    expect(formatUsd(5)).toBe('US$0.05');
  });

  test('rejects fractional or negative cents', () => {
    expect(() => formatUsd(1.5)).toThrow(RangeError);
    expect(() => formatUsd(-100)).toThrow(RangeError);
  });
});
