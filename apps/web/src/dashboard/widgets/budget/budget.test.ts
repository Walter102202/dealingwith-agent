import { describe, expect, it } from 'vitest';
import { budgetMeter } from './budget.js';

describe('budgetMeter', () => {
  it('shows what is left of the limit', () => {
    expect(budgetMeter(6000, 30000)).toEqual({
      spentCents: 6000,
      limitCents: 30000,
      remainingCents: 24000,
      spentPercent: 20,
      overLimit: false,
    });
  });

  it('starts empty before the agent spends', () => {
    expect(budgetMeter(0, 30000)).toMatchObject({ remainingCents: 30000, spentPercent: 0 });
    expect(budgetMeter(null, 30000)).toMatchObject({ spentCents: 0, remainingCents: 30000 });
  });

  it('never goes below zero left or past a full bar', () => {
    expect(budgetMeter(31000, 30000)).toMatchObject({
      remainingCents: 0,
      spentPercent: 100,
      overLimit: true,
    });
  });

  it('rounds the bar to a whole percent', () => {
    expect(budgetMeter(1000, 30000)?.spentPercent).toBe(3);
  });

  it('handles a zero limit without dividing by zero', () => {
    expect(budgetMeter(0, 0)).toMatchObject({ spentPercent: 0, remainingCents: 0 });
    expect(budgetMeter(100, 0)).toMatchObject({ spentPercent: 100, overLimit: true });
  });

  it('is null when there is no mandate (blank limit)', () => {
    expect(budgetMeter(null, null)).toBeNull();
    expect(budgetMeter(undefined, undefined)).toBeNull();
  });
});
