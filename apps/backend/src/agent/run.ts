import { type AgentOutput, AgentOutputSchema, type ContextPack } from '@dealingwith/contracts';
import { generateText, type LanguageModel, NoObjectGeneratedError, Output } from 'ai';
import type { Db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { renderContextPack } from './context/render.js';
import { loadInstructions, loadSkill, resolvePromptVersion, type SkillName } from './prompts.js';

export type AgentRunDeps = {
  db: Db;
  model: LanguageModel;
  /** Recorded in `agent_runs.provider` and `agent_runs.model`. */
  provider: string;
  modelName: string;
  now?: () => Date;
};

export type AgentRunInput = {
  pack: ContextPack;
  text: string;
  skill: SkillName;
  requestId: string;
  answers?: Record<string, string>;
  quoteId?: string;
  quoteVersion?: number;
};

export type AgentRunResult = { output: AgentOutput; runId: string };

export type AgentRunOutcome = 'ok' | 'invalid_output' | 'error';

/**
 * Thrown when a run cannot produce a valid output. `invalid_output` (422): the
 * model answered twice outside the schema. `agent_failed` (502): the provider
 * call itself failed. The run is recorded in `agent_runs` before this is thrown.
 */
export class AgentRunError extends Error {
  readonly code: 'invalid_output' | 'agent_failed';
  readonly status: 422 | 502;
  readonly runId: string;

  constructor(code: 'invalid_output' | 'agent_failed', message: string, runId: string) {
    super(message);
    this.name = 'AgentRunError';
    this.code = code;
    this.status = code === 'invalid_output' ? 422 : 502;
    this.runId = runId;
  }
}

type Usage = { inputTokens: number; outputTokens: number };

const MAX_ATTEMPTS = 2;

/**
 * One structured call per request (spec section 7.3): instructions plus the
 * skill as the system prompt, the rendered context pack plus the request as
 * the user prompt, the output parsed against `AgentOutputSchema`. An answer
 * outside the schema (an amount, an unknown key) is retried once with the
 * validation error quoted back; a second failure ends as `invalid_output`.
 * Every run writes one `agent_runs` row whatever the outcome.
 */
export async function runAgent(deps: AgentRunDeps, input: AgentRunInput): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const system = `${loadInstructions()}\n\n${loadSkill(input.skill)}`;
  const basePrompt = buildPrompt(input);
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let lastSchemaError = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = attempt === 1 ? basePrompt : withCorrection(basePrompt, lastSchemaError);
    try {
      const result = await generateText({
        model: deps.model,
        system,
        prompt,
        output: Output.object({ schema: AgentOutputSchema }),
      });
      addUsage(usage, result.usage);
      const runId = await recordRun(deps, input, { outcome: 'ok', usage, startedAt });
      return { output: result.output, runId };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        addUsage(usage, error.usage);
        lastSchemaError = describeError(error);
        continue;
      }
      const message = describeError(error);
      const runId = await recordRun(deps, input, { outcome: 'error', usage, startedAt, message });
      throw new AgentRunError('agent_failed', message, runId);
    }
  }

  const runId = await recordRun(deps, input, {
    outcome: 'invalid_output',
    usage,
    startedAt,
    message: lastSchemaError,
  });
  throw new AgentRunError(
    'invalid_output',
    `The agent's output did not match the schema after ${MAX_ATTEMPTS} attempts: ${lastSchemaError}`,
    runId,
  );
}

function buildPrompt(input: AgentRunInput): string {
  const parts = [renderContextPack(input.pack), `# Request\n${input.text.trim()}`];
  const answers = Object.entries(input.answers ?? {});
  if (answers.length > 0) {
    parts.push(
      [
        '# Answers to the open questions',
        ...answers.map(([question, answer]) => `- Q: ${question}\n  A: ${answer}`),
      ].join('\n'),
    );
  }
  return `${parts.join('\n\n')}\n`;
}

function withCorrection(prompt: string, schemaError: string): string {
  return `${prompt}\n# Correction\nYour previous answer did not match the required output schema: ${schemaError}\nReturn only the JSON object with exactly the keys described in the instructions. Never include an amount or price field: the system computes every amount.\n`;
}

function addUsage(
  total: Usage,
  usage: { inputTokens?: number | undefined; outputTokens?: number | undefined } | undefined,
): void {
  total.inputTokens += usage?.inputTokens ?? 0;
  total.outputTokens += usage?.outputTokens ?? 0;
}

/** The error message plus its cause chain, so a schema failure names the offending key. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const messages = [error.message];
  let cause: unknown = error.cause;
  for (let depth = 0; cause instanceof Error && depth < 3; depth += 1) {
    messages.push(cause.message);
    cause = cause.cause;
  }
  return messages.join(' | ');
}

async function recordRun(
  deps: AgentRunDeps,
  input: AgentRunInput,
  run: { outcome: AgentRunOutcome; usage: Usage; startedAt: number; message?: string },
): Promise<string> {
  const now = deps.now?.() ?? new Date();
  const [row] = await deps.db
    .insert(schema.agentRuns)
    .values({
      requestId: input.requestId,
      quoteId: input.quoteId ?? null,
      quoteVersion: input.quoteVersion ?? null,
      provider: deps.provider,
      model: deps.modelName,
      promptVersion: resolvePromptVersion(),
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
      latencyMs: Math.max(0, now.getTime() - run.startedAt),
      outcome: run.outcome,
      error: run.message ?? null,
      createdAt: now,
    })
    .returning({ id: schema.agentRuns.id });
  if (!row) {
    throw new Error('agent_runs insert returned no row');
  }
  return row.id;
}
