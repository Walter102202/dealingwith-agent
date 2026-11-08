import { readFileSync } from 'node:fs';
import type { AgentOutput } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { gradeClassification } from './classification.js';

function fixture(name: string): AgentOutput {
  const raw = readFileSync(new URL(`../scenarios/fixtures/${name}`, import.meta.url), 'utf8');
  return (JSON.parse(raw) as { output: AgentOutput }).output;
}

describe('gradeClassification', () => {
  test('fixture 1 passes against included C1 and rule S2.report', () => {
    const result = gradeClassification(fixture('01-web-monday-summary.json'), {
      included: ['C1'],
      rules: ['S2.report'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: true, missing: [], extra: [] });
  });

  test('fixture 3 fails against rule S2.report with S2.report missing and S2.alert extra', () => {
    const result = gradeClassification(fixture('03-agent-sales-drop-alert.json'), {
      included: [],
      rules: ['S2.report'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: false, missing: ['S2.report'], extra: ['S2.alert'] });
  });

  test('a missing included clause is reported as missing', () => {
    const result = gradeClassification(fixture('03-agent-sales-drop-alert.json'), {
      included: ['C4'],
      rules: ['S2.alert'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: false, missing: ['included:C4'], extra: [] });
  });

  test('fixture 5 passes when a question is expected and no lines are', () => {
    const result = gradeClassification(fixture('05-needs-info.json'), {
      included: [],
      rules: [],
      needsInfo: true,
    });
    expect(result).toEqual({ pass: true, missing: [], extra: [] });
  });

  test('an unexpected question fails with needs_info as extra', () => {
    const result = gradeClassification(fixture('05-needs-info.json'), {
      included: [],
      rules: [],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: false, missing: [], extra: ['needs_info'] });
  });

  test('a missing question fails with needs_info as missing', () => {
    const result = gradeClassification(fixture('04-already-covered.json'), {
      included: ['C4'],
      rules: [],
      needsInfo: true,
    });
    expect(result).toEqual({ pass: false, missing: ['needs_info'], extra: [] });
  });

  test('the same rule cited twice is a double charge and fails with the duplicate as extra', () => {
    const output = fixture('03-agent-sales-drop-alert.json');
    const twice: AgentOutput = { ...output, lineItems: [...output.lineItems, ...output.lineItems] };
    const result = gradeClassification(twice, {
      included: [],
      rules: ['S2.alert'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: false, missing: [], extra: ['S2.alert'] });
  });

  test('an included line cannot satisfy an expected rule of the same id', () => {
    const output = fixture('03-agent-sales-drop-alert.json');
    const line = output.lineItems[0];
    if (line?.kind !== 'rule') throw new Error('fixture 3 has one rule line');
    const asIncluded: AgentOutput = {
      ...output,
      lineItems: [
        { kind: 'included', scopeRef: 'S2.alert', label: line.label, rationale: line.rationale },
      ],
    };
    const result = gradeClassification(asIncluded, {
      included: [],
      rules: ['S2.alert'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: false, missing: ['S2.alert'], extra: ['included:S2.alert'] });
  });

  test('a wrong quantity on a per-unit rule fails and names both quantities', () => {
    const output = fixture('02-agent-amazon-source.json');
    const doubled: AgentOutput = {
      ...output,
      lineItems: output.lineItems.map((l) =>
        l.kind === 'rule' && l.ref.id === 'S3.per_source' ? { ...l, quantity: 2 } : l,
      ),
    };
    const expected = {
      included: [],
      rules: ['S3.base', 'S3.per_source'],
      needsInfo: false,
      quantities: { 'S3.per_source': 1 },
    };
    expect(gradeClassification(output, expected)).toEqual({ pass: true, missing: [], extra: [] });
    expect(gradeClassification(doubled, expected)).toEqual({
      pass: false,
      missing: ['S3.per_source x1'],
      extra: ['S3.per_source x2'],
    });
  });
});
