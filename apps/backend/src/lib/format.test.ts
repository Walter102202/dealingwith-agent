import { describe, expect, test } from 'vitest';
import { formatUsd } from './format.js';

describe('formatUsd', () => {
  test.each([
    [8000, 'US$80.00'],
    [123450, 'US$1,234.50'],
    [0, 'US$0.00'],
  ])('formats %i cents', (cents, expected) => {
    expect(formatUsd(cents)).toBe(expected);
  });
  test('rejects fractional cents', () => {
    expect(() => formatUsd(1.5)).toThrow(RangeError);
  });
});
