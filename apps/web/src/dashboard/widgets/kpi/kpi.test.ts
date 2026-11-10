import { describe, expect, it } from 'vitest';
import { countLine } from './kpi.js';

const words = { one: 'quote waiting for the client', many: 'quotes waiting for the client' };

describe('countLine', () => {
  it('uses the singular words for one', () => {
    expect(countLine(1, '1', words)).toBe('1 quote waiting for the client');
  });

  it('uses the plural words otherwise, zero included', () => {
    expect(countLine(2, '2', words)).toBe('2 quotes waiting for the client');
    expect(countLine(0, '0', words)).toBe('0 quotes waiting for the client');
  });

  it('shows the bare count without words', () => {
    expect(countLine(3, '3', {})).toBe('3');
  });

  it('shows nothing for a blank or non-numeric count', () => {
    expect(countLine(null, '', words)).toBeNull();
    expect(countLine('2', '2', words)).toBeNull();
  });
});
