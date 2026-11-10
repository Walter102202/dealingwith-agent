import {
  ApiErrorSchema,
  type AssistantConversationItem,
  type AssistantTurnEvent,
  type AssistantTurnFrame,
  AssistantTurnFrameSchema,
  type AssistantTurnRequest,
  type AssistantTurnResponse,
} from '@dealingwith/contracts';
import type {
  AgAiConversationItem,
  AgAiEvent,
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponse,
  AgLlmResponseHandler,
} from 'ag-studio';
import { routes } from '../../api/routes.js';

/**
 * AG Studio's `AgLlmAdapter`, pointed at our backend: it posts each turn to
 * `/api/dashboard/assistant/turn` and replays the SSE frames it gets back. All
 * provider work (Claude, the key, the caps) stays on the server (decision
 * 2026-11-10-assistant-anthropic-adapter-on-backend).
 */

/** A failed turn, with the server's stable code. */
export class AssistantTurnFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantTurnFailure';
  }
}

// The contract mirrors AG's types: these fail to compile if the two drift.
const asAgEvent = (event: AssistantTurnEvent): AgAiEvent => event;
const asAgResponse = (response: AssistantTurnResponse): AgLlmResponse => response;
const asAgItem = (item: AssistantConversationItem): AgAiConversationItem => item;
void asAgItem;

type Fetch = typeof fetch;

export function claudeAdapter(options: { endpoint?: string; fetch?: Fetch } = {}): AgLlmAdapter {
  const endpoint = options.endpoint ?? routes.dashboard.assistantTurn;
  const doFetch: Fetch = options.fetch ?? ((input, init) => fetch(input, init));
  return {
    executeTurn: (request, turnOptions) => runTurn(doFetch, endpoint, request, turnOptions?.signal),
  };
}

function runTurn(
  doFetch: Fetch,
  endpoint: string,
  request: AgLlmRequest,
  signal: AbortSignal | undefined,
): AgLlmResponseHandler {
  let settle!: { resolve: (r: AgLlmResponse) => void; reject: (e: Error) => void };
  const complete = new Promise<AgLlmResponse>((resolve, reject) => {
    settle = { resolve, reject };
  });
  // The failure is reported through `complete` only. Marking it observed keeps a
  // consumer that abandons the stream from raising an unhandled rejection.
  void complete.catch(() => {});

  async function* events(): AsyncGenerator<AgAiEvent> {
    let terminal: AssistantTurnFrame | undefined;
    try {
      const response = await doFetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify(toTurnRequest(request)),
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw await httpFailure(response);
      if (!response.body)
        throw new AssistantTurnFailure('assistant_no_stream', 'No response stream');
      for await (const frame of readFrames(response.body)) {
        if (frame.type === 'done' || frame.type === 'error') {
          terminal = frame;
          break;
        }
        yield asAgEvent(frame);
      }
    } catch (error) {
      settle.reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (terminal?.type === 'done') settle.resolve(asAgResponse(terminal.response));
    else if (terminal?.type === 'error')
      settle.reject(new AssistantTurnFailure(terminal.error.code, terminal.error.message));
    else
      settle.reject(
        new AssistantTurnFailure('assistant_stream_interrupted', 'The answer stopped unexpectedly'),
      );
  }

  const stream = events();
  return { stream: { [Symbol.asyncIterator]: () => stream }, complete };
}

/**
 * AG's request narrowed to what the backend supports: text only (attachments
 * are refused before the call), client tools only, and an allow-listed effort.
 */
export function toTurnRequest(request: AgLlmRequest): AssistantTurnRequest {
  const input = request.input.map((item): AssistantConversationItem => {
    if (item.type !== 'message') return item;
    if (item.kind === 'output')
      // Annotations (citations, file paths) never come from this backend; drop them.
      return {
        ...item,
        content: item.content.map((part) =>
          part.type === 'text' ? { type: 'text' as const, text: part.text, annotations: [] } : part,
        ),
      };
    const content = item.content.map((part) => {
      if (part.type !== 'text')
        throw new AssistantTurnFailure(
          'assistant_attachment_unsupported',
          'Attachments are not supported by this assistant; describe what you need in words',
        );
      return part;
    });
    return { ...item, content };
  });
  const tools = (request.tools ?? [])
    .filter((tool) => (tool.kind ?? 'client') === 'client')
    .map(({ name, description, parameters }) => ({ name, description, parameters }));
  const { responseFormat, instructions, toolChoice, model } = request;
  return {
    input,
    responseFormat:
      responseFormat.type === 'text'
        ? { type: 'text' }
        : {
            type: 'json',
            name: responseFormat.name,
            ...(responseFormat.description ? { description: responseFormat.description } : {}),
            schema: responseFormat.schema,
          },
    ...(instructions !== undefined ? { instructions } : {}),
    ...(tools.length ? { tools } : {}),
    ...(toolChoice !== undefined ? { toolChoice } : {}),
    ...(model
      ? { model: { id: model.id, effort: model.effort === 'medium' ? 'medium' : 'low' } }
      : {}),
  };
}

async function httpFailure(response: Response): Promise<AssistantTurnFailure> {
  const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  return parsed.success
    ? new AssistantTurnFailure(parsed.data.error.code, parsed.data.error.message)
    : new AssistantTurnFailure(
        'http_error',
        `The assistant answered with status ${response.status}`,
      );
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

/** Server-sent events: frames end with a blank line; `data:` lines carry the JSON. */
export async function* readFrames(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AssistantTurnFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = done ? '' : (chunks.pop() ?? '');
      for (const chunk of chunks) {
        const data = chunk
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data) continue;
        const frame = AssistantTurnFrameSchema.safeParse(parseJson(data));
        if (!frame.success)
          throw new AssistantTurnFailure(
            'assistant_bad_frame',
            'The assistant sent an unreadable frame',
          );
        yield frame.data;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}
