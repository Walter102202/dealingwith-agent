import { type LineItemIntent, QuoteLineItemSchema } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { demoClauses, demoServices } from '../../test/demo.js';
import { PricingError } from './errors.js';
import { priceIntents, resolveRule } from './pricing.js';

const rule = (id: string, quantity = 1, version = 1): LineItemIntent => ({
  kind: 'rule',
  ref: { id, version },
  quantity,
  label: id,
  rationale: `Priced by ${id}`,
});
const included = (scopeRef: string): LineItemIntent => ({
  kind: 'included',
  scopeRef,
  label: scopeRef,
  rationale: `Covered by ${scopeRef}`,
});
const price = (intents: LineItemIntent[]) =>
  priceIntents(intents, { services: demoServices(), scopeClauses: demoClauses() });
describe('priceIntents', () => {
  test('prices included C1 at zero', () => {
    expect(price([included('C1')])).toMatchObject({
      lineItems: [{ amountCents: 0 }],
      totalCents: 0,
    });
  });
  test('prices the scheduled email using the catalog version', () => {
    expect(price([rule('S2.report')])).toMatchObject({
      lineItems: [{ amountCents: 8000, ruleRef: { id: 'S2.report', version: 1 } }],
      totalCents: 8000,
    });
  });
  test('prices the Amazon integration at 19000 cents', () => {
    expect(price([rule('S3.base'), rule('S3.per_source')])).toMatchObject({
      subtotalCents: 19000,
      totalCents: 19000,
    });
  });
  test('applies rush after base lines while preserving input order', () => {
    const result = price([rule('S3.rush'), rule('S3.base'), rule('S3.per_source')]);
    expect(result).toMatchObject({ subtotalCents: 19000, totalCents: 23750 });
    expect(result.lineItems.map((line) => line.amountCents)).toEqual([4750, 15000, 4000]);
    expect(QuoteLineItemSchema.array().parse(result.lineItems)).toEqual(result.lineItems);
  });
  test('ignores the requested rule version for pricing', () => {
    expect(price([rule('S2.report', 1, 9)]).lineItems[0]).toMatchObject({
      amountCents: 8000,
      ruleRef: { version: 1 },
    });
  });
  test.each([
    [rule('S9.nope'), 'unknown_rule'],
    [included('C2'), 'excluded_scope_ref'],
    [included('C9'), 'unknown_scope_ref'],
  ] as const)('rejects invalid reference %j', (intent, code) => {
    expect(() => price([intent])).toThrow(PricingError);
    try {
      price([intent]);
    } catch (error) {
      expect(error).toMatchObject({ code, status: 422 });
    }
  });
  test('keeps a multiplier without a base at zero', () => {
    expect(price([rule('S3.rush')])).toMatchObject({
      lineItems: [{ amountCents: 0 }],
      totalCents: 0,
    });
  });
  test('multiplies the per-source price by quantity', () => {
    expect(price([rule('S3.per_source', 3)]).totalCents).toBe(12000);
  });
  test('does not compound multipliers or include other services in their base', () => {
    const result = price([rule('S3.base'), rule('S3.rush'), rule('S3.rush')]);
    expect(result.lineItems.map((line) => line.amountCents)).toEqual([15000, 3750, 3750]);
    expect(result.totalCents).toBe(22500);
    expect(price([rule('S2.report'), rule('S3.rush')]).totalCents).toBe(8000);
  });
  test('preserves params, label and rationale without mutating input', () => {
    const intent = { ...rule('S2.report'), params: { day: 'Monday' } };
    const before = structuredClone(intent);
    expect(price([intent]).lineItems[0]).toMatchObject(intent);
    expect(intent).toEqual(before);
  });
});
describe('resolveRule', () => {
  test('resolves the highest version across services and returns null for unknown ids', () => {
    const services = demoServices();
    services[0]?.pricingRules.push({
      id: 'S2.report',
      version: 2,
      label: 'New report',
      type: 'fixed',
      amountCents: 9000,
    });
    expect(resolveRule(services, 'S2.report')?.rule.version).toBe(2);
    expect(priceIntents([rule('S2.report')], { services, scopeClauses: [] }).totalCents).toBe(9000);
    expect(resolveRule(services, 'missing')).toBeNull();
  });
});
