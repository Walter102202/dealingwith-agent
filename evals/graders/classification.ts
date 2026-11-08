import type { AgentOutput } from '@dealingwith/contracts';

export type ExpectedClassification = {
  /** Scope clause ids the output must mark as included, e.g. `['C1']`, each exactly once. */
  included: string[];
  /** Pricing rule ids (without version) the output must cite, e.g. `['S2.report']`, each exactly once. */
  rules: string[];
  /** Whether the output must ask at least one question. */
  needsInfo: boolean;
  /** Required `quantity` per cited rule id; a rule not listed here may carry any quantity. */
  quantities?: Record<string, number>;
};

export type ClassificationGrade = {
  pass: boolean;
  /** What was expected and not produced: `S2.report`, `included:C4`, `needs_info`, `S3.per_source x1`. */
  missing: string[];
  /** What was produced and not expected, including duplicate citations and wrong quantities. */
  extra: string[];
};

const NEEDS_INFO = 'needs_info';

function count(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Compares two multisets; every surplus citation is a line the client would pay for twice. */
function compare(
  actual: Map<string, number>,
  expected: Map<string, number>,
  label: (id: string) => string,
  missing: string[],
  extra: string[],
): void {
  for (const [id, want] of expected) {
    const have = actual.get(id) ?? 0;
    for (let i = have; i < want; i += 1) missing.push(label(id));
    for (let i = want; i < have; i += 1) extra.push(label(id));
  }
  for (const [id, have] of actual) {
    if (!expected.has(id)) {
      for (let i = 0; i < have; i += 1) extra.push(label(id));
    }
  }
}

/**
 * Grades what the agent decided, not how it worded it: which clauses it marked
 * as included, which rules it cited (version ignored: the engine resolves it)
 * and with what quantity, and whether it asked. Rule and clause ids live in
 * separate namespaces, so an `included` line never satisfies an expected rule.
 * Amounts are never graded because the model never produces them (spec section 4).
 */
export function gradeClassification(
  output: AgentOutput,
  expected: ExpectedClassification,
): ClassificationGrade {
  const missing: string[] = [];
  const extra: string[] = [];

  const ruleLines = output.lineItems.filter((line) => line.kind === 'rule');
  const includedLines = output.lineItems.filter((line) => line.kind === 'included');

  compare(
    count(ruleLines.map((line) => line.ref.id)),
    count(expected.rules),
    (id) => id,
    missing,
    extra,
  );
  compare(
    count(includedLines.map((line) => line.scopeRef)),
    count(expected.included),
    (id) => `included:${id}`,
    missing,
    extra,
  );

  for (const [id, want] of Object.entries(expected.quantities ?? {})) {
    for (const line of ruleLines) {
      if (line.ref.id === id && line.quantity !== want) {
        missing.push(`${id} x${want}`);
        extra.push(`${id} x${line.quantity}`);
      }
    }
  }

  const asked = output.needsInfo.length > 0;
  if (expected.needsInfo && !asked) missing.push(NEEDS_INFO);
  if (!expected.needsInfo && asked) extra.push(NEEDS_INFO);

  return { pass: missing.length === 0 && extra.length === 0, missing, extra };
}
