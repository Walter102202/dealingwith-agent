import type Anthropic from '@anthropic-ai/sdk';
import type {
  AssistantConversationItem,
  AssistantToolSchema,
  AssistantTurnRequest,
} from '@dealingwith/contracts';
import { AppError } from '../lib/errors.js';

/**
 * AG Studio turn request → Anthropic Messages parameters.
 *
 * Thinking blocks are never replayed (decision 2026-11-10-assistant-no-thinking-replay):
 * AG's conversation items cannot carry signatures, and Studio rebuilds the
 * instructions and tool schemas from live dashboard state on every turn. Each
 * assistant turn is rebuilt from its text and `tool_use` blocks only.
 */

export type AnthropicTurnParams = Anthropic.Beta.Messages.MessageCreateParamsStreaming;
type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type ToolResultParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type ToolParam = Anthropic.Beta.Messages.BetaTool;

export const ASSISTANT_MAX_TOKENS = 16000;
/** Server-side refusal fallback, routed by refusal category ("default" form). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const CONTINUE = 'Continue.';
const MISSING_RESULT = 'No result was recorded for this call.';

type Turn = { role: 'user' | 'assistant'; content: ContentParam[]; key?: string | undefined };

export function encodeTurn(request: AssistantTurnRequest, model: string): AnthropicTurnParams {
  if (request.responseFormat.type !== 'text')
    throw new AppError(
      'assistant_unsupported_format',
      'This assistant answers in text only; structured JSON responses are not supported',
    );
  const { turns, systemNotes } = encodeConversation(request.input);
  const steer = toolSteering(request.toolChoice);
  // Sonnet 5.5 refuses an assistant prefill: a conversation that ends on the
  // model (AG's retry after a turn that skipped a required tool) gets a nudge.
  if (turns.at(-1)?.role !== 'user')
    turns.push({ role: 'user', content: [text(steer ? `${CONTINUE} ${steer}` : CONTINUE)] });
  const system = [request.instructions, ...systemNotes, steer]
    .filter((part): part is string => Boolean(part?.trim()))
    .join('\n\n');
  const tools = (request.tools ?? []).map(encodeTool);
  return {
    model,
    max_tokens: ASSISTANT_MAX_TOKENS,
    stream: true,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: request.model?.effort ?? 'low' },
    ...(system ? { system } : {}),
    ...(tools.length ? { tools } : {}),
    ...(tools.length && request.toolChoice === 'none' ? { tool_choice: { type: 'none' } } : {}),
    messages: turns.map(({ role, content }): MessageParam => ({ role, content })),
  };
}

/**
 * Forced tool choice (`any` / `tool`) is a 400 on Sonnet 5.5, so a required
 * call becomes `auto` plus an instruction.
 */
function toolSteering(choice: AssistantTurnRequest['toolChoice']): string | undefined {
  if (choice === 'required')
    return 'You must call at least one of the available tools in this response.';
  if (typeof choice === 'object')
    return `You must call the \`${choice.name}\` tool in this response.`;
  return undefined;
}

function encodeTool(tool: AssistantToolSchema): ToolParam {
  const { type, ...schema } = tool.parameters;
  if (type !== undefined && type !== 'object')
    throw new AppError('assistant_invalid_tool', `Tool ${tool.name} must take an object`);
  // No `strict`: AG validates the arguments itself and feeds errors back to the model.
  return {
    name: tool.name,
    description: tool.description,
    input_schema: { ...schema, type: 'object' },
    eager_input_streaming: true,
  };
}

/**
 * Merges AG's flat item list into alternating turns: one assistant message per
 * model turn (text and every tool call), then ONE user message holding all of
 * that turn's tool results before any user text.
 */
export function encodeConversation(items: AssistantConversationItem[]): {
  turns: Turn[];
  systemNotes: string[];
} {
  const turns: Turn[] = [];
  const systemNotes: string[] = [];
  let pending: ToolResultParam[] = [];
  const last = () => turns.at(-1);
  const flushResults = () => {
    if (!pending.length) return;
    turns.push({ role: 'user', content: pending });
    pending = [];
  };
  const pushAssistant = (blocks: ContentParam[], key: string | undefined) => {
    if (!blocks.length) return;
    const current = last();
    // Studio appends each call's result right after it, so a model turn with
    // two calls arrives as call, result, call, result: the item ids we minted
    // (`<message id>:<block index>`) tell that apart from two turns.
    if (current?.role === 'assistant' && (!pending.length || (key && key === current.key))) {
      current.content.push(...blocks);
      return;
    }
    flushResults();
    turns.push({ role: 'assistant', content: blocks, key });
  };
  const pushUser = (blocks: ContentParam[]) => {
    flushResults();
    if (!blocks.length) return;
    const current = last();
    if (current?.role === 'user') current.content.push(...blocks);
    else turns.push({ role: 'user', content: blocks });
  };

  for (const item of items) {
    if (item.type === 'message' && item.kind === 'input') {
      const texts = item.content.map((part) => part.text).filter((value) => value.trim());
      if (item.role === 'system') systemNotes.push(...texts);
      else pushUser(texts.map(text));
    } else if (item.type === 'message') {
      const blocks = item.content
        .map((part) => (part.type === 'text' ? part.text : part.refusal))
        .filter((value) => value.trim())
        .map(text);
      pushAssistant(blocks, turnKey(item.id));
    } else if (item.type === 'function_call') {
      pushAssistant(
        [{ type: 'tool_use', id: toolUseId(item.callId), name: item.name, input: args(item) }],
        turnKey(item.id),
      );
    } else if (item.type === 'function_call_output') {
      pending.push({
        type: 'tool_result',
        tool_use_id: toolUseId(item.callId),
        content: item.output,
      });
    }
    // Reasoning items are dropped: thinking is never replayed.
  }
  flushResults();
  return { turns: pairToolResults(turns), systemNotes };
}

/**
 * The API rejects a `tool_use` without its result in the next user message and
 * a result without its call. A cancelled run can leave either behind.
 */
function pairToolResults(turns: Turn[]): Turn[] {
  const out: Turn[] = [];
  let open: string[] = [];
  const closeOpen = (user: Turn | undefined): Turn | undefined => {
    if (!open.length) return user;
    const answered = new Set(
      (user?.content ?? []).flatMap((b) => (b.type === 'tool_result' ? [b.tool_use_id] : [])),
    );
    const missing: ContentParam[] = open
      .filter((id) => !answered.has(id))
      .map((id) => ({
        type: 'tool_result',
        tool_use_id: id,
        content: MISSING_RESULT,
        is_error: true,
      }));
    return { role: 'user', content: [...missing, ...(user?.content ?? [])] };
  };
  for (const turn of turns) {
    if (turn.role === 'assistant') {
      const closed = closeOpen(undefined);
      if (closed) out.push(closed);
      open = turn.content.flatMap((b) => (b.type === 'tool_use' ? [b.id] : []));
      out.push(turn);
      continue;
    }
    const allowed = new Set(open);
    const content = turn.content.filter(
      (b) => b.type !== 'tool_result' || allowed.has(b.tool_use_id),
    );
    const user = closeOpen({ role: 'user', content });
    open = [];
    if (user?.content.length) out.push(sortResultsFirst(user));
  }
  const closed = closeOpen(undefined);
  if (closed) out.push(closed);
  if (out[0]?.role === 'assistant') out.unshift({ role: 'user', content: [text(CONTINUE)] });
  return out;
}

function sortResultsFirst(turn: Turn): Turn {
  const results = turn.content.filter((b) => b.type === 'tool_result');
  const rest = turn.content.filter((b) => b.type !== 'tool_result');
  return { role: turn.role, content: [...results, ...rest] };
}

/** `msg_01X:3` → `msg_01X`: the model turn an item we minted belongs to. */
export function turnKey(id: string | undefined): string | undefined {
  const match = id ? /^(.+):\d+$/.exec(id) : null;
  return match?.[1];
}

/** Tool-use ids must match `^[a-zA-Z0-9_-]+$`; AG-seeded calls may use other characters. */
function toolUseId(callId: string): string {
  return callId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function args(item: { arguments: string }): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(item.arguments || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function text(value: string): ContentParam {
  return { type: 'text', text: value };
}
