import { describe, expect, test } from 'vitest';
import { compact, toIso, toIsoOrUndefined } from './serialize.js';

describe('compact', () => {
  test('omits undefined keys but preserves null and zero', () => {
    expect(compact({ a: 1, b: undefined, c: null, d: 0 })).toEqual({ a: 1, c: null, d: 0 });
  });
});
describe('toIso', () => {
  test('serializes dates and optional dates', () => {
    expect(toIso(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(toIsoOrUndefined(null)).toBeUndefined();
    expect(toIsoOrUndefined(new Date(0))).toBe(toIso(new Date(0)));
  });
});
