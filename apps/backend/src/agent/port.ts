import type { AgentOutput, ContextPack } from '@dealingwith/contracts';
import type { Db } from '../db/client.js';
import { type BuildContextPackInput, buildContextPack } from './context/build.js';
import type { SkillName } from './prompts.js';
import { describeModel, getModel, type LlmEnv } from './provider.js';
import { runAgent } from './run.js';

/**
 * What the workflows need from the agent (plan Task A5, `workflows/deps.ts`).
 * Declared structurally here so Track B builds without Track A's `Deps`; the
 * integrator points this at `workflows/deps.ts` at merge. Workflows pass their
 * full `Deps`, which is a superset of `AgentDeps`.
 */
export type AgentDeps = { db: Db };

export type AgentRunRequest = {
  pack: ContextPack;
  text: string;
  skill: SkillName;
  requestId: string;
  answers?: Record<string, string>;
};

export type AgentPort = {
  buildContextPack(db: Db, input: BuildContextPackInput): Promise<ContextPack>;
  runAgent(
    deps: AgentDeps,
    input: AgentRunRequest,
  ): Promise<{ output: AgentOutput; runId: string }>;
};

/**
 * The real agent behind `deps.agent`. The model is resolved once from the
 * environment (a missing API key fails at startup, not on the first request).
 */
export function createAgentPort(env: LlmEnv): AgentPort {
  const model = getModel(env);
  const { provider, model: modelName } = describeModel(env);
  return {
    buildContextPack,
    runAgent: (deps, input) => runAgent({ db: deps.db, model, provider, modelName }, input),
  };
}
