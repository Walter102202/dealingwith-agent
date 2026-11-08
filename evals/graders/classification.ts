import type { AgentOutput } from '@dealingwith/contracts';

export type ExpectedClassification = {
  /** Scope clause ids the output must mark as included, e.g. `['C1']`. */
  included: string[];
  /** Pricing rule ids (without version) the output must cite, e.g. `['S2.report']`. */
  rules: string[];
  /** Whether the output must ask at least one question. */
  needsInfo: boolean;
};

export type ClassificationGrade = {
  pass: boolean;
  /** Expected refs the output did not produce; `needs_info` when a question was expected. */
  missing: string[];
  /** Refs the output produced that were not expected; `needs_info` for an unexpected question. */
  extra: string[];
};

const NEEDS_INFO = 'needs_info';

/**
 * Grades what the agent decided, not how it worded it: which clauses it marked
 * as included, which rules it cited (version ignored: the engine resolves it),
 * and whether it asked. Amounts are never graded because the model never
 * produces them (spec section 4).
 */
export function gradeClassification(
  output: AgentOutput,
  expected: ExpectedClassification,
): ClassificationGrade {
  const actual = new Set<string>();
  for (const line of output.lineItems) {
    actual.add(line.kind === 'included' ? line.scopeRef : line.ref.id);
  }
  if (output.needsInfo.length > 0) {
    actual.add(NEEDS_INFO);
  }

  const wanted = new Set<string>([...expected.included, ...expected.rules]);
  if (expected.needsInfo) {
    wanted.add(NEEDS_INFO);
  }

  const missing = [...wanted].filter((ref) => !actual.has(ref));
  const extra = [...actual].filter((ref) => !wanted.has(ref));
  return { pass: missing.length === 0 && extra.length === 0, missing, extra };
}
