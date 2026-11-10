import type { AssistantTurnFrame } from '@dealingwith/contracts';
import type { AgAiEvent, AgLlmRequest } from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';
import { AssistantTurnFailure, claudeAdapter, toTurnRequest } from './adapter.js';

const request: AgLlmRequest = {
  input: [
    {
      id: 'u1',
      kind: 'input',
      type: 'message',
      role: 'user',
      content: [{ type: 'text', text: 'Who owes us?' }],
      status: 'completed',
    },
  ],
  instructions: 'You are the orchestrator.',
  tools: [{ name: 'view_schema', description: 'Schema', parameters: { type: 'object' } }],
  responseFormat: { type: 'text' },
  model: { id: 'claude-sonnet-5-5', effort: 'medium' },
};

const done: AssistantTurnFrame = {
  type: 'done',
  response: {
    id: 'msg_1',
    createdAt: 1,
    status: 'completed',
    output: [
      {
        id: 'msg_1:0',
        kind: 'output',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'text', text: 'Acme.', annotations: [] }],
      },
    ],
    usage: { inputTokens: 10, outputTokens: 2 },
    model: 'claude-sonnet-5-5',
  },
};

const sse = (frames: AssistantTurnFrame[]) =>
  frames.map((f) => `event: ${f.type}\ndata: ${JSON.stringify(f)}\n\n`).join('');

/** A fetch whose body arrives in the given pieces, to exercise frames split across chunks. */
function fakeFetch(pieces: Array<string | Uint8Array>, init: { status?: number } = {}) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces)
          controller.enqueue(typeof piece === 'string' ? encoder.encode(piece) : piece);
        controller.close();
      },
    });
    return new Response(body, {
      status: init.status ?? 200,
      headers: { 'content-type': init.status ? 'application/json' : 'text/event-stream' },
    });
  });
}

async function drain(stream: AsyncIterable<AgAiEvent>) {
  const events: AgAiEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

describe('claudeAdapter', () => {
  it('posts the turn, yields the AG events and settles with the done frame', async () => {
    const wire = sse([
      { type: 'TEXT_MESSAGE_START', messageId: 'msg_1:0', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'msg_1:0', delta: 'Acme · US$' },
      { type: 'TEXT_MESSAGE_END', messageId: 'msg_1:0' },
      done,
    ]);
    // Cut the wire at odd places: inside a frame and inside the two bytes of "·".
    const bytes = new TextEncoder().encode(wire);
    const dot = bytes.indexOf(0xc2);
    const fetch = fakeFetch([bytes.slice(0, 7), bytes.slice(7, dot + 1), bytes.slice(dot + 1)]);
    const controller = new AbortController();
    const handler = claudeAdapter({ fetch }).executeTurn(request, { signal: controller.signal });
    const events = await drain(handler.stream);
    expect(events.map((e) => e.type)).toEqual([
      'TEXT_MESSAGE_START',
      'TEXT_MESSAGE_CONTENT',
      'TEXT_MESSAGE_END',
    ]);
    expect(events[1]).toMatchObject({ delta: 'Acme · US$' });
    await expect(handler.complete).resolves.toEqual(done.type === 'done' ? done.response : null);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/dashboard/assistant/turn');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
    });
    expect(JSON.parse(String(init?.body))).toEqual(toTurnRequest(request));
  });

  it('rejects complete with the code of an error frame', async () => {
    const fetch = fakeFetch([
      sse([{ type: 'error', error: { code: 'assistant_refused', message: 'Declined' } }]),
    ]);
    const handler = claudeAdapter({ fetch }).executeTurn(request);
    expect(await drain(handler.stream)).toEqual([]);
    await expect(handler.complete).rejects.toMatchObject({
      name: 'AssistantTurnFailure',
      code: 'assistant_refused',
      message: 'Declined',
    });
  });

  it('turns an HTTP error into a failure with the API code', async () => {
    const fetch = fakeFetch(
      [JSON.stringify({ error: { code: 'assistant_daily_limit', message: 'Come back tomorrow' } })],
      { status: 429 },
    );
    const handler = claudeAdapter({ fetch }).executeTurn(request);
    await drain(handler.stream);
    await expect(handler.complete).rejects.toMatchObject({ code: 'assistant_daily_limit' });
  });

  it('fails a stream that ends without a terminal frame, or sends an unreadable one', async () => {
    const cut = claudeAdapter({
      fetch: fakeFetch([sse([{ type: 'TEXT_MESSAGE_END', messageId: 'm' }])]),
    }).executeTurn(request);
    expect(await drain(cut.stream)).toHaveLength(1);
    await expect(cut.complete).rejects.toMatchObject({ code: 'assistant_stream_interrupted' });
    const garbled = claudeAdapter({ fetch: fakeFetch(['data: {"type":"RUN_STARTED"}\n\n']) });
    const turn = garbled.executeTurn(request);
    await drain(turn.stream);
    await expect(turn.complete).rejects.toMatchObject({ code: 'assistant_bad_frame' });
  });

  it('an abandoned failed turn raises no unhandled rejection', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const fetch = vi.fn(async () => {
      throw new TypeError('network down');
    });
    const handler = claudeAdapter({ fetch }).executeTurn(request);
    await drain(handler.stream);
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    await expect(handler.complete).rejects.toThrow('network down');
  });
});

describe('toTurnRequest', () => {
  it('keeps client tools, allow-lists the effort and drops output annotations', () => {
    const turn = toTurnRequest({
      ...request,
      input: [
        ...request.input,
        {
          id: 'msg_1:0',
          kind: 'output',
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [
            {
              type: 'text',
              text: 'See',
              annotations: [{ type: 'file_path', fileId: 'f', index: 0 }],
            },
          ],
        },
      ],
      tools: [
        { name: 'view_schema', description: 'Schema', parameters: { type: 'object' } },
        { name: 'web_search', description: 'Web', parameters: {}, kind: 'provided', provider: {} },
      ],
      model: { id: 'claude-sonnet-5-5', effort: 'max' },
      toolChoice: 'required',
    });
    expect(turn.tools?.map((t) => t.name)).toEqual(['view_schema']);
    expect(turn.model).toEqual({ id: 'claude-sonnet-5-5', effort: 'low' });
    expect(turn.toolChoice).toBe('required');
    expect(turn.input[1]).toMatchObject({
      content: [{ type: 'text', text: 'See', annotations: [] }],
    });
  });

  it('refuses attachments before calling the server', () => {
    expect(() =>
      toTurnRequest({
        ...request,
        input: [
          {
            id: 'u1',
            kind: 'input',
            type: 'message',
            role: 'user',
            content: [{ type: 'image', detail: 'auto', imageUrl: 'data:image/png;base64,AA' }],
            status: 'completed',
          },
        ],
      }),
    ).toThrow(AssistantTurnFailure);
  });
});
