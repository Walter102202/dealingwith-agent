import { describe, expect, test } from 'vitest';
import { AgentOutputSchema, LineItemIntentSchema } from './agent.js';

const fixture = {
  lineItems: [
    {
      kind: 'included',
      scopeRef: 'C1',
      label: 'Per-branch view',
      rationale: 'Covered by clause C1: five views including a per-branch view.',
    },
    {
      kind: 'rule',
      ref: { id: 'S2.report', version: 1 },
      quantity: 1,
      label: 'Weekly Monday summary email',
      rationale: 'Scheduled emails are excluded by clause C2 and priced by rule S2.report.',
    },
  ],
  needsInfo: [],
  explanation: 'The per-branch view is included; the Monday summary email is an automation.',
  deliveryDays: 1,
  confidence: 0.9,
};

describe('AgentOutputSchema', () => {
  test('parses the demo fixture', () => {
    const parsed = AgentOutputSchema.parse(fixture);
    expect(parsed.lineItems).toHaveLength(2);
    expect(parsed.lineItems[1]).toMatchObject({ kind: 'rule', quantity: 1 });
  });

  test('defaults quantity to 1 on rule intents', () => {
    const parsed = LineItemIntentSchema.parse({
      kind: 'rule',
      ref: { id: 'S2.alert', version: 1 },
      label: 'Threshold alert email',
      rationale: 'Alerts are excluded by C2.',
    });
    expect(parsed).toMatchObject({ kind: 'rule', quantity: 1 });
  });

  test('a rule intent may cite the clause that excludes the need', () => {
    const parsed = AgentOutputSchema.parse({
      lineItems: [
        {
          kind: 'rule',
          ref: { id: 'S2.report', version: 1 },
          scopeRef: 'C2',
          label: 'Weekly Monday summary email',
          rationale: 'Clause C2 excludes scheduled emails; rule S2.report prices one.',
        },
      ],
      needsInfo: [],
      explanation: 'One extra.',
      deliveryDays: 1,
      confidence: 0.9,
    });
    expect(parsed.lineItems[0]?.kind === 'rule' && parsed.lineItems[0].scopeRef).toBe('C2');
  });

  test('rejects an unknown intent kind', () => {
    const result = LineItemIntentSchema.safeParse({
      kind: 'price',
      label: 'Something',
      rationale: 'Made up',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a rule intent carrying an amount (the model never prices)', () => {
    const result = LineItemIntentSchema.safeParse({
      kind: 'rule',
      ref: { id: 'S2.report', version: 1 },
      quantity: 1,
      label: 'Weekly Monday summary email',
      rationale: 'Priced by S2.report.',
      amountCents: 8000,
    });
    expect(result.success).toBe(false);
  });

  test('rejects confidence outside 0..1 and non-integer delivery days', () => {
    expect(AgentOutputSchema.safeParse({ ...fixture, confidence: 1.2 }).success).toBe(false);
    expect(AgentOutputSchema.safeParse({ ...fixture, deliveryDays: 1.5 }).success).toBe(false);
  });
});
