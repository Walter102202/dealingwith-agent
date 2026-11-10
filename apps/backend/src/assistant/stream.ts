import type Anthropic from '@anthropic-ai/sdk';
import type {
  AssistantOutputItem,
  AssistantTurnError,
  AssistantTurnEvent,
  AssistantTurnResponse,
} from '@dealingwith/contracts';

/**
 * Anthropic stream events → AG Studio content events, plus the settled turn.
 *
 * Item ids are `<message id>:<block index>`, which is how the encoder later
 * recognises the calls of one model turn in AG's history. A turn emits content
 * events only; the run and step boundaries belong to Studio's loop.
 */

export type RawStreamEvent = Anthropic.Beta.Messages.BetaRawMessageStreamEvent;
type StopReason = Anthropic.Beta.Messages.BetaStopReason;

type Block =
  | { kind: 'text'; id: string; text: string }
  | { kind: 'thinking'; id: string; text: string }
  | { kind: 'tool'; id: string; callId: string; name: string; json: string; open: boolean }
  | { kind: 'other' };

export type TurnOutcome =
  | { ok: true; response: AssistantTurnResponse }
  | { ok: false; error: AssistantTurnError };

/** What the per-turn log line reports; never prompt or answer text. */
export type TurnSummary = {
  model: string | undefined;
  stopReason: StopReason | undefined;
  refusalCategory: string | undefined;
  toolCalls: number;
  fellBack: boolean;
  usage: AssistantTurnResponse['usage'];
};

export class TurnTranslator {
  private readonly blocks = new Map<number, Block>();
  private messageId = '';
  private model: string | undefined;
  private stopReason: StopReason | undefined;
  private refusalCategory: string | undefined;
  private fallbackIndex = -1;
  private finished = false;
  private input = { uncached: 0, cacheRead: 0, cacheWrite: 0 };
  private outputTokens = 0;

  constructor(private readonly startedAt: number) {}

  translate(event: RawStreamEvent): AssistantTurnEvent[] {
    switch (event.type) {
      case 'message_start': {
        const { id, model, usage } = event.message;
        this.messageId = id;
        this.model = model;
        this.input = {
          uncached: usage.input_tokens,
          cacheRead: usage.cache_read_input_tokens ?? 0,
          cacheWrite: usage.cache_creation_input_tokens ?? 0,
        };
        this.outputTokens = usage.output_tokens;
        return [];
      }
      case 'content_block_start':
        return this.start(event.index, event.content_block);
      case 'content_block_delta':
        return this.delta(event.index, event.delta);
      case 'content_block_stop':
        return this.stop(event.index);
      case 'message_delta': {
        this.stopReason = event.delta.stop_reason ?? this.stopReason;
        this.refusalCategory = event.delta.stop_details?.category ?? this.refusalCategory;
        const { usage } = event;
        this.outputTokens = usage.output_tokens;
        if (usage.input_tokens != null) this.input.uncached = usage.input_tokens;
        if (usage.cache_read_input_tokens != null)
          this.input.cacheRead = usage.cache_read_input_tokens;
        if (usage.cache_creation_input_tokens != null)
          this.input.cacheWrite = usage.cache_creation_input_tokens;
        return [];
      }
      case 'message_stop':
        this.finished = true;
        return [];
    }
  }

  private itemId(index: number): string {
    return `${this.messageId}:${index}`;
  }

  private start(
    index: number,
    block: Anthropic.Beta.Messages.BetaRawContentBlockStartEvent['content_block'],
  ): AssistantTurnEvent[] {
    const id = this.itemId(index);
    switch (block.type) {
      case 'text':
        this.blocks.set(index, { kind: 'text', id, text: block.text });
        return [
          { type: 'TEXT_MESSAGE_START', messageId: id, role: 'assistant' },
          ...(block.text
            ? [{ type: 'TEXT_MESSAGE_CONTENT' as const, messageId: id, delta: block.text }]
            : []),
        ];
      case 'thinking':
        // Opened at once so the chat shows the model working before a summary arrives.
        this.blocks.set(index, { kind: 'thinking', id, text: block.thinking });
        return [{ type: 'REASONING_MESSAGE_START', messageId: id, role: 'reasoning' }];
      case 'tool_use':
        this.blocks.set(index, {
          kind: 'tool',
          id,
          callId: block.id,
          name: block.name,
          json: '',
          open: true,
        });
        return [{ type: 'TOOL_CALL_START', toolCallId: block.id, toolCallName: block.name }];
      case 'fallback':
        return this.fallBack(index, block.to.model);
      default:
        this.blocks.set(index, { kind: 'other' });
        return [];
    }
  }

  private delta(
    index: number,
    delta: Anthropic.Beta.Messages.BetaRawContentBlockDelta,
  ): AssistantTurnEvent[] {
    const block = this.blocks.get(index);
    if (delta.type === 'text_delta' && block?.kind === 'text') {
      block.text += delta.text;
      return [{ type: 'TEXT_MESSAGE_CONTENT', messageId: block.id, delta: delta.text }];
    }
    if (delta.type === 'thinking_delta' && block?.kind === 'thinking' && delta.thinking) {
      block.text += delta.thinking;
      return [{ type: 'REASONING_MESSAGE_CONTENT', messageId: block.id, delta: delta.thinking }];
    }
    if (delta.type === 'input_json_delta' && block?.kind === 'tool' && block.open) {
      block.json += delta.partial_json;
      return [{ type: 'TOOL_CALL_ARGS', toolCallId: block.callId, delta: delta.partial_json }];
    }
    return [];
  }

  private stop(index: number): AssistantTurnEvent[] {
    const block = this.blocks.get(index);
    if (block?.kind === 'text') return [{ type: 'TEXT_MESSAGE_END', messageId: block.id }];
    if (block?.kind === 'thinking') return [{ type: 'REASONING_MESSAGE_END', messageId: block.id }];
    if (block?.kind === 'tool' && block.open) {
      block.open = false;
      return [{ type: 'TOOL_CALL_END', toolCallId: block.callId }];
    }
    return [];
  }

  /**
   * A refusal fallback took over mid-turn. Text before it stays (the fallback
   * model continues it); tool calls before it are dropped from the turn, so any
   * still streaming are closed for the chat and never executed.
   */
  private fallBack(index: number, model: string): AssistantTurnEvent[] {
    this.fallbackIndex = index;
    this.model = model;
    this.blocks.set(index, { kind: 'other' });
    const events: AssistantTurnEvent[] = [];
    for (const block of this.blocks.values()) {
      if (block.kind === 'tool' && block.open) {
        block.open = false;
        events.push({ type: 'TOOL_CALL_END', toolCallId: block.callId });
      }
    }
    return events;
  }

  private calls(): Extract<Block, { kind: 'tool' }>[] {
    return [...this.blocks.entries()]
      .filter(([index]) => index > this.fallbackIndex)
      .flatMap(([, block]) => (block.kind === 'tool' ? [block] : []));
  }

  summary(): TurnSummary {
    return {
      model: this.model,
      stopReason: this.stopReason,
      refusalCategory: this.refusalCategory,
      toolCalls: this.calls().length,
      fellBack: this.fallbackIndex >= 0,
      usage: this.usage(),
    };
  }

  private usage(): NonNullable<AssistantTurnResponse['usage']> {
    const inputTokens = this.input.uncached + this.input.cacheRead + this.input.cacheWrite;
    return {
      inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: inputTokens + this.outputTokens,
      cachedInputTokens: this.input.cacheRead,
      cacheWriteTokens: this.input.cacheWrite,
    };
  }

  /** The settled turn, or why it failed. Call once the upstream stream has ended. */
  finish(): TurnOutcome {
    if (!this.finished)
      return fail(
        'assistant_stream_interrupted',
        'The model stopped streaming before the turn ended.',
      );
    const calls = this.calls();
    switch (this.stopReason) {
      case 'refusal':
        return fail(
          'assistant_refused',
          `Claude declined this request${this.refusalCategory ? ` (${this.refusalCategory})` : ''}. Rephrase it and try again.`,
        );
      case 'model_context_window_exceeded':
        return fail(
          'assistant_context_exceeded',
          'This conversation is too long for the model. Start a new conversation.',
        );
      case 'max_tokens':
        // A cut tool input can still parse as a valid partial object: never hand it on.
        if (calls.length)
          return fail(
            'assistant_truncated_tool_call',
            'The answer hit the output limit in the middle of a tool call. Ask for a smaller step.',
          );
        break;
    }
    const output: AssistantOutputItem[] = [];
    for (const [index, block] of [...this.blocks.entries()].sort(([a], [b]) => a - b)) {
      if (block.kind === 'text' && block.text)
        output.push({
          id: block.id,
          kind: 'output',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'text', text: block.text, annotations: [] }],
        });
      else if (block.kind === 'thinking' && block.text.trim())
        output.push({
          id: block.id,
          kind: 'output',
          type: 'reasoning',
          summary: [{ type: 'summary', text: block.text }],
        });
      else if (block.kind === 'tool' && index > this.fallbackIndex)
        output.push({
          id: block.id,
          kind: 'output',
          type: 'function_call',
          callId: block.callId,
          name: block.name,
          arguments: block.json || '{}',
          status: 'completed',
        });
    }
    const truncated = this.stopReason === 'max_tokens';
    return {
      ok: true,
      response: {
        id: this.messageId,
        createdAt: this.startedAt,
        status: truncated ? 'incomplete' : 'completed',
        ...(truncated ? { incompleteDetails: { reason: 'max_output_tokens' as const } } : {}),
        output,
        usage: this.usage(),
        ...(this.model ? { model: this.model } : {}),
      },
    };
  }
}

function fail(code: string, message: string): TurnOutcome {
  return { ok: false, error: { code, message } };
}
