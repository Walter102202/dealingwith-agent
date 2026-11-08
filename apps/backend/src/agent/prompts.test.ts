import { describe, expect, test } from 'vitest';
import { loadInstructions, loadSkill, resolvePromptVersion, SKILLS } from './prompts.js';

describe('loadInstructions', () => {
  test('the system prompt states the rules the anti-goals require', () => {
    const text = loadInstructions();
    expect(text).toMatch(/never (compute|calculate|invent)[^.]*price/i);
    expect(text).toMatch(/cite/i);
    expect(text).toMatch(/paid additionals/i);
    expect(text).toMatch(/ask[^.]*changes the price/i);
    expect(text).toContain('"lineItems"');
  });

  test('the system prompt never suggests putting unit counts in params', () => {
    expect(loadInstructions()).not.toMatch(/"sources": 2/);
  });
});

describe('loadSkill', () => {
  test('the three skills load and name their task', () => {
    expect(SKILLS).toEqual(['contract-service', 'analyze-additional', 'explain-quote']);
    for (const skill of SKILLS) {
      const text = loadSkill(skill);
      expect(text.length).toBeGreaterThan(200);
      expect(text).toMatch(/^# /m);
    }
  });

  test('analyze-additional makes any included clause win over an excluded one', () => {
    const text = loadSkill('analyze-additional');
    expect(text).toMatch(/included clause[^.]*(covers|wins|decides)/i);
    expect(text).not.toMatch(/first clause whose text covers the need decides/i);
  });

  test('a path-like skill name is rejected', () => {
    // @ts-expect-error the type forbids it; the runtime must too
    expect(() => loadSkill('../instructions')).toThrow(/unknown skill/i);
  });
});

describe('resolvePromptVersion', () => {
  test('is a git short SHA when available, else dev', () => {
    expect(resolvePromptVersion()).toMatch(/^([0-9a-f]{7,12}|dev)$/);
  });
});
