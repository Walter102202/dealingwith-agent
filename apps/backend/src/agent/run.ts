import { type AgentOutput, AgentOutputSchema, type ContextPack } from '@dealingwith/contracts';
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from 'ai';
import type { Db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { renderContextPack } from './context/render.js';
import { loadInstructions, loadSkill, resolvePromptVersion, type SkillName } from './prompts.js';
import type { ModelObject } from './provider.js';

export type AgentRunDeps = {
  db: Db;
  model: ModelObject;
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
    const attemptResult = await generateOnce(deps.model, system, prompt, usage);
    if (attemptResult.kind === 'ok') {
      const runId = await recordRun(deps, input, { outcome: 'ok', usage, startedAt });
      return { output: attemptResult.output, runId };
    }
    if (attemptResult.kind === 'error') {
      const runId = await recordRun(deps, input, {
        outcome: 'error',
        usage,
        startedAt,
        message: attemptResult.message,
      });
      throw new AgentRunError('agent_failed', attemptResult.message, runId);
    }
    lastSchemaError = attemptResult.message;
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

type Attempt =
  | { kind: 'ok'; output: AgentOutput }
  | { kind: 'invalid'; message: string }
  | { kind: 'error'; message: string };

/**
 * Anthropic: ask for native structured output (the default mode falls back to
 * an optional JSON tool when the schema has an open record, and the model may
 * then answer in prose). OpenAI: the schema has optional keys and a union, which
 * its strict mode rejects, so validation stays on our side (Zod, every run).
 */
const PROVIDER_OPTIONS = {
  anthropic: { structuredOutputMode: 'outputFormat' },
  openai: { strictJsonSchema: false },
} as const;

async function generateOnce(
  model: ModelObject,
  system: string,
  prompt: string,
  usage: Usage,
): Promise<Attempt> {
  try {
    const result = await generateText({
      model,
      system,
      prompt,
      output: Output.object({ schema: AgentOutputSchema }),
      providerOptions: PROVIDER_OPTIONS,
    });
    addUsage(usage, result.usage);
    // The getter throws NoOutputGeneratedError when the model produced no text (refusal, length).
    const output = AgentOutputSchema.parse(result.output);
    const amountInText = findAmountInText(output);
    if (amountInText) {
      return { kind: 'invalid', message: `the output text contains an amount: "${amountInText}"` };
    }
    return { kind: 'ok', output };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      addUsage(usage, error.usage);
      return { kind: 'invalid', message: describeError(error) };
    }
    if (NoOutputGeneratedError.isInstance(error)) {
      return { kind: 'invalid', message: describeError(error) };
    }
    return { kind: 'error', message: describeError(error) };
  }
}

/** `US$80`, `$ 80.00`, `80 USD`, `80 dollars`: the model must never write amounts (spec section 4). */
const AMOUNT_IN_TEXT = /(?:US)?\$\s?\d|\b\d[\d,.]*\s?(?:USD|dollars?)\b/i;

function findAmountInText(output: AgentOutput): string | null {
  const texts = [
    output.explanation,
    ...output.lineItems.flatMap((line) => [line.label, line.rationale]),
    ...output.needsInfo.flatMap((item) => [item.question, item.whyItChangesPrice]),
  ];
  for (const text of texts) {
    if (AMOUNT_IN_TEXT.test(text)) {
      return text;
    }
  }
  return null;
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
