import { describe, expect, test } from 'vitest';
import { PricingRuleSchema, ruleRefLabel, ServiceSchema } from './catalog.js';

describe('ruleRefLabel', () => {
  test('renders id and version as the spec writes them', () => {
    expect(ruleRefLabel({ id: 'S2.report', version: 1 })).toBe('S2.report.v1');
  });
});

describe('PricingRuleSchema', () => {
  test('accepts fixed, per-unit and multiplier rules', () => {
    expect(
      PricingRuleSchema.parse({
        id: 'S1.price',
        version: 1,
        type: 'fixed',
        label: 'Analytics dashboard build',
        amountCents: 120000,
      }).type,
    ).toBe('fixed');
    expect(
      PricingRuleSchema.parse({
        id: 'S3.per_source',
        version: 1,
        type: 'per_unit',
        label: 'Per data source',
        amountCents: 4000,
        unit: 'source',
      }).type,
    ).toBe('per_unit');
    expect(
      PricingRuleSchema.parse({
        id: 'S3.rush',
        version: 1,
        type: 'multiplier',
        label: 'Rush under 48 h',
        percent: 25,
        conditions: 'delivery under 48 h',
      }).type,
    ).toBe('multiplier');
  });

  test('a multiplier needs a percent and a per-unit rule needs a unit', () => {
    expect(
      PricingRuleSchema.safeParse({ id: 'S3.rush', version: 1, type: 'multiplier', label: 'Rush' })
        .success,
    ).toBe(false);
    expect(
      PricingRuleSchema.safeParse({
        id: 'S3.per_source',
        version: 1,
        type: 'per_unit',
        label: 'Per source',
        amountCents: 4000,
      }).success,
    ).toBe(false);
  });
});

describe('ServiceSchema', () => {
  test('parses a service with rules, inclusions and exclusions', () => {
    const service = ServiceSchema.parse({
      id: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a01',
      businessId: '5b4b6a1e-0d7e-4a51-9f2a-2d3b1c8e9a00',
      name: 'Automations',
      description: 'Scheduled emails and alerts on an existing dashboard.',
      pricingRules: [
        {
          id: 'S2.report',
          version: 1,
          type: 'fixed',
          label: 'Scheduled report email',
          amountCents: 8000,
        },
      ],
      inclusions: ['one automation per rule, on an existing dashboard'],
      exclusions: ['new views', 'new data sources'],
      deliveryDays: 1,
    });
    expect(service.pricingRules[0]?.id).toBe('S2.report');
  });
});
