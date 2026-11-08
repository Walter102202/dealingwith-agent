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
    expect(result).toEqual({ pass: false, missing: ['C4'], extra: [] });
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

  test('the same rule cited twice counts once', () => {
    const output = fixture('03-agent-sales-drop-alert.json');
    const twice: AgentOutput = { ...output, lineItems: [...output.lineItems, ...output.lineItems] };
    const result = gradeClassification(twice, {
      included: [],
      rules: ['S2.alert'],
      needsInfo: false,
    });
    expect(result).toEqual({ pass: true, missing: [], extra: [] });
  });
});
