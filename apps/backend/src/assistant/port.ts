import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../env.js';
import { createDailyTurnCap, type DailyTurnCap } from './daily-cap.js';
import type { AnthropicTurnParams } from './encode.js';
import type { RawStreamEvent } from './stream.js';

/**
 * What the assistant route needs from Claude: open one streamed turn. The real
 * implementation calls the official SDK; tests inject a scripted stream.
 * Failures surface as {@link AssistantUpstreamError} so callers never branch on
 * SDK classes.
 */
export type AssistantLlm = {
  open(params: AnthropicTurnParams, signal: AbortSignal): Promise<AsyncIterable<RawStreamEvent>>;
};

export type AssistantPort = { model: string; llm: AssistantLlm; cap: DailyTurnCap };

export class AssistantUpstreamError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly aborted = false,
  ) {
    super(message);
    this.name = 'AssistantUpstreamError';
  }
}

type AssistantEnv = Pick<
  Env,
  'ANTHROPIC_API_KEY' | 'ASSISTANT_MODEL' | 'ASSISTANT_DAILY_TURN_LIMIT'
>;

/** The assistant is on exactly when the server holds an Anthropic key; `null` otherwise. */
export function createAssistantPort(env: AssistantEnv, now: () => Date): AssistantPort | null {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    model: env.ASSISTANT_MODEL,
    llm: anthropicLlm(new Anthropic({ apiKey })),
    cap: createDailyTurnCap(env.ASSISTANT_DAILY_TURN_LIMIT, now),
  };
}

export function anthropicLlm(client: Anthropic): AssistantLlm {
  return {
    async open(params, signal) {
      try {
        const stream = await client.beta.messages.create(params, { signal });
        return normaliseErrors(stream);
      } catch (error) {
        throw toUpstreamError(error);
      }
    },
  };
}

async function* normaliseErrors(stream: AsyncIterable<RawStreamEvent>) {
  try {
    yield* stream;
  } catch (error) {
    throw toUpstreamError(error);
  }
}

/** Most specific first; the message names the cause without echoing the request. */
export function toUpstreamError(error: unknown): AssistantUpstreamError {
  if (error instanceof AssistantUpstreamError) return error;
  if (error instanceof Anthropic.APIUserAbortError)
    return new AssistantUpstreamError('assistant_cancelled', 'The turn was cancelled', 499, true);
  if (error instanceof Anthropic.RateLimitError)
    return new AssistantUpstreamError(
      'assistant_rate_limited',
      'Claude is rate limited right now; try again in a minute',
      429,
    );
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  )
    return new AssistantUpstreamError(
      'assistant_upstream_auth',
      'The server could not authenticate with Claude',
      502,
    );
  if (error instanceof Anthropic.BadRequestError)
    return new AssistantUpstreamError(
      'assistant_upstream_rejected',
      `Claude rejected the request: ${error.message}`,
      502,
    );
  if (error instanceof Anthropic.APIConnectionError)
    return new AssistantUpstreamError(
      'assistant_upstream_unreachable',
      'Claude is unreachable',
      502,
    );
  if (error instanceof Anthropic.APIError)
    return new AssistantUpstreamError(
      'assistant_upstream_unavailable',
      'Claude is unavailable right now; try again shortly',
      503,
    );
  return new AssistantUpstreamError('assistant_failed', 'The assistant turn failed', 500);
}
