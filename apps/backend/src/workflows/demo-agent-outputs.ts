import type { AgentOutput } from '@dealingwith/contracts';
import { MOCK_FIXTURES } from '../agent/mock-fixtures.js';

/**
 * The five scripted demo requests (plan Task A7 table), keyed by the phrase the
 * fake agent looks for in the request text. `src/agent/mock-fixtures.ts` is the
 * single source; the mock LLM provider and this fake port read the same rows.
 */
export const DEMO_AGENT_OUTPUTS: Record<string, AgentOutput> = Object.fromEntries(
  MOCK_FIXTURES.map((fixture) => [fixture.match, fixture.output]),
);
