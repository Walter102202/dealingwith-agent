import type {
  AgAiAgentContext,
  AgAiTool,
  AgAiToolContext,
  AgAiToolInvocation,
  AgAiToolResult,
  AgAnyAiAgentDefinition,
} from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIGURE_WIDGET,
  KEEP_FORMAT_GUIDANCE,
  keepFormatKeys,
  keepingFormat,
  keptNote,
  type StateReader,
  widgetKeepingFormat,
} from './keep-format.js';

type Fields = Record<string, unknown>;

/** The Unpaid additionals table as the Collections page saves it. */
const TABLE_FORMAT = {
  title: { enabled: true, text: 'Unpaid additionals' },
  subtitle: { enabled: true, text: 'Priced lines on quotes that are published or accepted.' },
  crossFilter: 'filter',
  style: { totalRow: true },
};

/**
 * A report with one table on each of two pages, and a `configure_widget` that
 * behaves like Studio 3.1.0's: it patches the widget one level deep (a key
 * sent replaces the current one whole) and writes once per call.
 */
function studio() {
  type Page = { id: string; widgets: Record<string, Fields> };
  const table = (format: Fields) => ({ type: 'quotes-table', format, dataMapping: {} });
  let state: { selectedPageId: string; pages: Page[] } = {
    selectedPageId: 'collections',
    pages: [
      { id: 'overview', widgets: { lines: table({ title: { enabled: true, text: 'Recent' } }) } },
      { id: 'collections', widgets: { lines: table(TABLE_FORMAT) } },
    ],
  };
  const writes: unknown[] = [];
  const configure = (pageId?: string): AgAiTool => ({
    name: CONFIGURE_WIDGET,
    description: 'Custom widget',
    kind: 'client',
    schema: () => undefined,
    execute: async (call) => {
      const { widgetId, value } = call.args as { widgetId: string; value: Fields };
      const page = state.pages.find((p) => p.id === (pageId ?? state.selectedPageId));
      const widgets = page?.widgets ?? {};
      const next = { ...widgets[widgetId], ...value };
      state = {
        ...state,
        pages: state.pages.map((p) =>
          p === page ? { ...p, widgets: { ...widgets, [widgetId]: next } } : p,
        ),
      };
      writes.push(next);
      return { success: true, response: `Configured widget ${widgetId}`, data: next };
    },
  });
  const widget = (pageId: string) =>
    state.pages.find((p) => p.id === pageId)?.widgets.lines as { format: Fields };
  const api = { getState: () => state } as unknown as StateReader;
  return { api, configure, widget, writes };
}

const ctx = {} as AgAiToolContext;
const call = (args: Fields): AgAiToolInvocation => ({
  toolCallId: 'call-1',
  name: CONFIGURE_WIDGET,
  args,
});
const restyle = (format: Fields, widgetId = 'lines') =>
  call({ widgetId, op: 'patch', value: { format } });

function widgetAgent(configure: AgAiTool): AgAnyAiAgentDefinition {
  const view = { name: 'view_widget' } as AgAiTool;
  return {
    id: 'widget',
    instructions: () => 'You configure a single widget.',
    tools: () => [view, configure],
  };
}

function runAgent(s: ReturnType<typeof studio>, params: Fields) {
  const configure = s.configure(params.pageId as string | undefined);
  const agent = widgetKeepingFormat(widgetAgent(configure), s.api);
  const agentCtx = {} as AgAiAgentContext;
  const tool = agent.tools?.(agentCtx, params).find((t) => t.name === CONFIGURE_WIDGET);
  return { agent, agentCtx, tool };
}

describe('keepFormatKeys', () => {
  it('fills in every key the new format leaves out and names them', () => {
    const { format, kept } = keepFormatKeys(
      { style: { density: 'compact', totalRow: false } },
      TABLE_FORMAT,
    );
    expect(format).toEqual({ ...TABLE_FORMAT, style: { density: 'compact', totalRow: false } });
    expect(kept).toEqual(['title', 'subtitle', 'crossFilter']);
  });

  it('keeps a key the new format sends as sent, so a title can be hidden', () => {
    const hidden = { enabled: false, text: 'Unpaid additionals' };
    const { format, kept } = keepFormatKeys({ title: hidden }, TABLE_FORMAT);
    expect(format.title).toBe(hidden);
    expect(kept).toEqual(['subtitle', 'crossFilter', 'style']);
  });

  it('returns the new format itself when nothing is left out', () => {
    const next = { ...TABLE_FORMAT, caption: { enabled: false } };
    expect(keepFormatKeys(next, { ...TABLE_FORMAT, widget: undefined })).toEqual({
      format: next,
      kept: [],
    });
  });
});

describe('the Widget agent with configure_widget keeping format', () => {
  it('without the wrapper, a style-only restyle erases the title (the bug)', async () => {
    const s = studio();
    await s.configure().execute?.(restyle({ style: { density: 'compact' } }), ctx);
    expect(s.widget('collections').format).toEqual({ style: { density: 'compact' } });
  });

  it('keeps the titles and cross filter of a style-only restyle, in one write', async () => {
    const s = studio();
    const { tool } = runAgent(s, { widgetType: 'quotes-table', widgetId: 'lines' });
    const result = await tool?.execute?.(
      restyle({ style: { density: 'compact', totalRow: false } }),
      ctx,
    );
    expect(s.widget('collections').format).toEqual({
      ...TABLE_FORMAT,
      style: { density: 'compact', totalRow: false },
    });
    expect(s.writes).toHaveLength(1);
    expect(result).toMatchObject({ success: true });
    expect(result?.success && result.response).toBe(
      `Configured widget lines\n\n${keptNote(['title', 'subtitle', 'crossFilter'])}`,
    );
  });

  it('hides a title the call disables on purpose', async () => {
    const s = studio();
    const { tool } = runAgent(s, { widgetType: 'quotes-table', widgetId: 'lines' });
    const hidden = { enabled: false, text: 'Unpaid additionals' };
    await tool?.execute?.(restyle({ title: hidden }), ctx);
    expect(s.widget('collections').format).toEqual({ ...TABLE_FORMAT, title: hidden });
  });

  it('reads the widget on the agent page when it is given one', async () => {
    const s = studio();
    const { tool } = runAgent(s, { widgetType: 'quotes-table', pageId: 'overview' });
    await tool?.execute?.(restyle({ style: { totalRow: false } }), ctx);
    expect(s.widget('overview').format).toEqual({
      title: { enabled: true, text: 'Recent' },
      style: { totalRow: false },
    });
    expect(s.widget('collections').format).toBe(TABLE_FORMAT);
  });

  it.each([
    ['a call without format', call({ widgetId: 'lines', op: 'patch', value: { dataMapping: {} } })],
    ['a widget that is not there', restyle({ style: {} }, 'missing')],
    ['a call already carrying every key', restyle({ ...TABLE_FORMAT, style: {} })],
  ])('passes %s through untouched', async (_case, invocation) => {
    const execute = vi.fn(async (): Promise<AgAiToolResult> => ({ success: true, response: 'ok' }));
    const read = () => ({ type: 'quotes-table', format: TABLE_FORMAT });
    const tool = keepingFormat(
      { name: CONFIGURE_WIDGET, description: '', kind: 'client', schema: () => undefined, execute },
      (id) => (id === 'lines' ? read() : undefined),
      'quotes-table',
    );
    expect(await tool.execute?.(invocation, ctx)).toEqual({ success: true, response: 'ok' });
    expect(execute).toHaveBeenCalledWith(invocation, ctx);
  });

  it('leaves a change of widget type alone: the old format belongs to the old type', async () => {
    const s = studio();
    const { tool } = runAgent(s, { widgetType: 'grid', widgetId: 'lines' });
    await tool?.execute?.(restyle({ style: { density: 'compact' } }), ctx);
    expect(s.widget('collections').format).toEqual({ style: { density: 'compact' } });
  });

  it('tells the agent what was kept when Studio rejects the call', async () => {
    const execute = async (): Promise<AgAiToolResult> => ({
      success: false,
      issues: [{ message: 'value.format.style.density: invalid' }],
    });
    const tool = keepingFormat(
      { name: CONFIGURE_WIDGET, description: '', kind: 'client', schema: () => undefined, execute },
      () => ({ type: 'kpi-tile', format: { title: { enabled: true, text: 'Collected' } } }),
      'kpi-tile',
    );
    expect(await tool.execute?.(restyle({ style: { valueSize: 'huge' } }), ctx)).toEqual({
      success: false,
      issues: [
        { message: 'value.format.style.density: invalid' },
        { message: keptNote(['title']) },
      ],
    });
  });

  it('adds the rule to the instructions and leaves the other tools as they are', () => {
    const s = studio();
    const { agent, agentCtx } = runAgent(s, { widgetType: 'quotes-table' });
    const instructions = agent.instructions?.(agentCtx, {}) ?? '';
    expect(instructions).toBe(`You configure a single widget.\n\n${KEEP_FORMAT_GUIDANCE}`);
    expect(KEEP_FORMAT_GUIDANCE).toMatch(/enabled: false/);
    const tools = agent.tools?.(agentCtx, {}) ?? [];
    expect(tools.map((t) => t.name)).toEqual(['view_widget', CONFIGURE_WIDGET]);
    expect(tools[0]).toEqual({ name: 'view_widget' });
  });

  it('keeps a tool that Studio runs elsewhere as it is', () => {
    const tool: AgAiTool = {
      name: CONFIGURE_WIDGET,
      description: '',
      kind: 'server',
      schema: () => undefined,
    };
    expect(keepingFormat(tool, () => undefined, 'grid')).toBe(tool);
  });
});
