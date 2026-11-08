import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentOutputSchema } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { findFixture, MOCK_FIXTURES, type MockFixture } from './mock-fixtures.js';

const FIXTURES_DIR = fileURLToPath(
  new URL('../../../../evals/scenarios/fixtures/', import.meta.url),
);

const DEMO_REQUESTS = [
  'I need a per-branch view and a summary email every Monday.',
  'Add our Amazon sales as a second source, no rush.',
  "Alert me by email when any branch's daily sales drop more than 20%.",
  'Send the Monday summary to our regional managers too.',
  'Make the dashboard load faster.',
];

describe('MOCK_FIXTURES', () => {
  test('there are five fixtures and every output satisfies the strict agent schema', () => {
    expect(MOCK_FIXTURES).toHaveLength(5);
    for (const fixture of MOCK_FIXTURES) {
      expect(() => AgentOutputSchema.parse(fixture.output)).not.toThrow();
    }
  });

  test('the fixtures mirror the Task A7 table: refs, labels, delivery and confidence', () => {
    const [monday, amazon, alert, managers, faster] = MOCK_FIXTURES;
    expect(monday?.output.lineItems).toMatchObject([
      { kind: 'included', scopeRef: 'C1', label: 'Per-branch view' },
      {
        kind: 'rule',
        ref: { id: 'S2.report', version: 1 },
        quantity: 1,
        label: 'Weekly Monday summary email',
      },
    ]);
    expect(monday?.output).toMatchObject({ deliveryDays: 1, confidence: 0.9, needsInfo: [] });

    expect(amazon?.output.lineItems).toMatchObject([
      {
        kind: 'rule',
        ref: { id: 'S3.base', version: 1 },
        label: 'Data source integration: Amazon',
      },
      {
        kind: 'rule',
        ref: { id: 'S3.per_source', version: 1 },
        quantity: 1,
        label: 'Additional data source: Amazon',
      },
    ]);
    expect(amazon?.output.deliveryDays).toBe(5);

    expect(alert?.output.lineItems).toMatchObject([
      { kind: 'rule', ref: { id: 'S2.alert', version: 1 }, label: 'Daily sales drop alert (20%)' },
    ]);
    expect(alert?.output.deliveryDays).toBe(1);

    expect(managers?.output.lineItems).toMatchObject([
      { kind: 'included', scopeRef: 'C4', label: 'Monday summary to regional managers' },
    ]);
    expect(managers?.output.deliveryDays).toBe(0);

    expect(faster?.output.lineItems).toEqual([]);
    expect(faster?.output.needsInfo).toEqual([
      {
        question: 'Is the slowness caused by data volume or by the dashboard design?',
        whyItChangesPrice:
          'More data means a data source integration; a redesign means a new dashboard build.',
      },
    ]);
    expect(faster?.output).toMatchObject({ deliveryDays: 0, confidence: 0.4 });
  });

  test('every line cites a clause or rule that exists in the demo data', () => {
    const known = /\b(C1|C2|C3|C4|S2\.report\.v1|S2\.alert\.v1|S3\.base\.v1|S3\.per_source\.v1)\b/;
    for (const fixture of MOCK_FIXTURES) {
      for (const line of fixture.output.lineItems) {
        expect(line.rationale).toMatch(known);
      }
    }
  });

  test('a rationale that says a clause excludes the need names an excluded clause', () => {
    const excludedClauses = ['C2'];
    for (const fixture of MOCK_FIXTURES) {
      for (const line of fixture.output.lineItems) {
        const cited = /excluded by clause (C\d+)/.exec(line.rationale)?.[1];
        if (cited) expect(excludedClauses).toContain(cited);
      }
    }
  });

  test('the JSON files in evals/scenarios/fixtures are the same five fixtures, field by field', () => {
    const files = readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();
    expect(files).toEqual([
      '01-web-monday-summary.json',
      '02-agent-amazon-source.json',
      '03-agent-sales-drop-alert.json',
      '04-already-covered.json',
      '05-needs-info.json',
    ]);
    const fromDisk: MockFixture[] = files.map((f) =>
      JSON.parse(readFileSync(join(FIXTURES_DIR, f), 'utf8')),
    );
    expect(fromDisk).toEqual(MOCK_FIXTURES);
  });
});

describe('findFixture', () => {
  test('each demo request matches its own fixture, in order', () => {
    const picked = DEMO_REQUESTS.map((text) => findFixture(text));
    expect(picked).toEqual(MOCK_FIXTURES);
  });

  test('matching ignores case', () => {
    expect(findFixture('MAKE THE DASHBOARD LOAD FASTER')).toBe(MOCK_FIXTURES[4]);
  });

  test('an unknown request has no fixture', () => {
    expect(findFixture('Paint my office')).toBeNull();
  });
});
