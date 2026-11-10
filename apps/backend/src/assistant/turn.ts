import type { AssistantTurnFrame, AssistantTurnRequest } from '@dealingwith/contracts';
import { AppError } from '../lib/errors.js';
import type { Logger } from '../observability/logger.js';
import { encodeTurn } from './encode.js';
import { type AssistantPort, toUpstreamError } from './port.js';
import { type RawStreamEvent, type TurnSummary, TurnTranslator } from './stream.js';

export type AssistantTurnContext = { signal: AbortSignal; logger: Logger; now: () => Date };

export type OpenedTurn = {
  /** Content events, then exactly one `done` or `error` frame. Never throws. */
  frames(): AsyncGenerator<AssistantTurnFrame>;
};

/**
 * Validates, counts and opens one assistant turn. Everything that can fail
 * before the first byte (unsupported request, daily cap, upstream refusing the
 * call) throws an `AppError`, so the route answers with a plain HTTP error;
 * once streaming, failures become an `error` frame.
 */
export async function openAssistantTurn(
  port: AssistantPort,
  request: AssistantTurnRequest,
  ctx: AssistantTurnContext,
): Promise<OpenedTurn> {
  const started = ctx.now().getTime();
  const effort = request.model?.effort ?? 'low';
  const log = (outcome: string, fields: Record<string, unknown> = {}) =>
    ctx.logger.info('assistant.turn', {
      model: port.model,
      effort,
      outcome,
      durationMs: ctx.now().getTime() - started,
      ...fields,
    });

  const params = encodeTurn(request, port.model);
  if (!port.cap.take()) {
    log('daily_limit');
    throw new AppError(
      'assistant_daily_limit',
      `The assistant has answered its ${port.cap.limit} turns for today. It resets at midnight UTC.`,
      { status: 429 },
    );
  }
  let upstream: AsyncIterable<RawStreamEvent>;
  try {
    upstream = await port.llm.open(params, ctx.signal);
  } catch (error) {
    const failure = toUpstreamError(error);
    log(failure.aborted ? 'cancelled' : 'upstream_error', { code: failure.code });
    throw new AppError(failure.code, failure.message, { status: failure.status });
  }

  return {
    async *frames() {
      const translator = new TurnTranslator(started);
      try {
        for await (const event of upstream) {
          for (const frame of translator.translate(event)) yield frame;
        }
      } catch (error) {
        const failure = toUpstreamError(error);
        log(failure.aborted ? 'cancelled' : 'upstream_error', {
          code: failure.code,
          ...logFields(translator.summary()),
        });
        if (!failure.aborted)
          yield { type: 'error', error: { code: failure.code, message: failure.message } };
        return;
      }
      const outcome = translator.finish();
      const summary = logFields(translator.summary());
      if (outcome.ok) {
        log(outcome.response.status, summary);
        yield { type: 'done', response: outcome.response };
      } else {
        log('failed', { code: outcome.error.code, ...summary });
        yield { type: 'error', error: outcome.error };
      }
    },
  };
}

function logFields(summary: TurnSummary): Record<string, unknown> {
  const { usage, ...rest } = summary;
  return {
    ...rest,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    cacheReadTokens: usage?.cachedInputTokens,
    cacheWriteTokens: usage?.cacheWriteTokens,
  };
}
