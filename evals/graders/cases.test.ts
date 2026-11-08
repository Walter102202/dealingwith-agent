import { readFileSync } from 'node:fs';
import type { AgentOutput } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { CASES } from '../live/cases.js';
import { gradeClassification } from './classification.js';

describe('CASES', () => {
  test('there is one case per fixture and each fixture passes its own expectation', () => {
    expect(CASES).toHaveLength(5);
    for (const evalCase of CASES) {
      const raw = readFileSync(
        new URL(`../scenarios/fixtures/${evalCase.id}.json`, import.meta.url),
        'utf8',
      );
      const fixture = JSON.parse(raw) as { match: string; output: AgentOutput };
      expect(evalCase.text).toMatch(new RegExp(fixture.match, 'i'));
      expect(gradeClassification(fixture.output, evalCase.expected)).toEqual({
        pass: true,
        missing: [],
        extra: [],
      });
    }
  });

  test('only the first case runs before the first payment', () => {
    expect(CASES.map((c) => c.afterFirstPayment)).toEqual([false, true, true, true, true]);
  });
});
