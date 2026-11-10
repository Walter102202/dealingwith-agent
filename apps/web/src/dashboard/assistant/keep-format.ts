import type {
  AgAiTool,
  AgAiToolInvocation,
  AgAiToolResult,
  AgAnyAiAgentDefinition,
  AgStudioApi,
} from 'ag-studio';

/**
 * An assistant restyle keeps what it does not change (decision
 * 2026-11-10-restyle-keeps-format-keys). Studio's `configure_widget` patches a
 * widget one level deep, so a `format` it receives replaces the current one
 * whole: a Widget agent that sends only `format.style` erases the titles, the
 * card and the cross filter (seen live on 2026-11-10). The Widget agent's
 * `configure_widget` is wrapped so every top-level format key a call leaves out
 * keeps its current value, for every widget type. A key the call sends wins as
 * sent, which is how a title is hidden on purpose (`enabled: false`). The edit
 * form never goes through this tool, so it is untouched.
 */

export const CONFIGURE_WIDGET = 'configure_widget';

/** Appended to the Widget agent's instructions. */
export const KEEP_FORMAT_GUIDANCE = `## Format keys you leave out are kept
configure_widget keeps every top-level format key you leave out (title, subtitle, caption, widget, crossFilter, triggerCrossFilter, style) at its current value, so send only the keys you change. A key you send replaces its current value whole: start from the value view_widget shows and change only what was asked. To hide a title, subtitle or caption, send it with its current text and enabled: false. To reset a widget's style to its defaults, send style: {}.`;

type Fields = Record<string, unknown>;

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * `next` plus every top-level key of `current` that `next` leaves out, and the
 * names of the keys it took. A key `next` sets wins, whatever its value.
 */
export function keepFormatKeys(next: Fields, current: Fields): { format: Fields; kept: string[] } {
  const kept = Object.keys(current).filter(
    (key) => next[key] === undefined && current[key] !== undefined,
  );
  if (kept.length === 0) return { format: next, kept };
  const format: Fields = { ...next };
  for (const key of kept) format[key] = current[key];
  return { format, kept };
}

/** Told to the agent with the tool result, so it knows what it did not send was kept. */
export const keptNote = (kept: readonly string[]) =>
  `Kept from the current format because this call left them out: ${kept.join(', ')}. To hide a title, subtitle or caption, send it with enabled: false.`;

/** Reads the widget a call names, as it stands when the call runs. */
export type WidgetReader = (widgetId: unknown) => Fields | undefined;

/**
 * The call with the left-out format keys filled in, or `undefined` when there
 * is nothing to fill: no `format` in the call, no such widget, or a widget of
 * another type (a type change rebuilds the widget, so its old format does not apply).
 */
function withKeptFormat(call: AgAiToolInvocation, read: WidgetReader, widgetType: unknown) {
  const { args } = call;
  const value = args.value;
  if (!isFields(value) || !isFields(value.format)) return undefined;
  const widget = read(args.widgetId);
  if (!widget || widget.type !== widgetType || !isFields(widget.format)) return undefined;
  const { format, kept } = keepFormatKeys(value.format, widget.format);
  if (kept.length === 0) return undefined;
  return { call: { ...call, args: { ...args, value: { ...value, format } } }, kept };
}

function withNote(result: AgAiToolResult, kept: readonly string[]): AgAiToolResult {
  const note = keptNote(kept);
  return result.success
    ? { ...result, response: `${result.response}\n\n${note}` }
    : { ...result, issues: [...result.issues, { message: note }] };
}

/**
 * `configure_widget` with the left-out format keys filled in before Studio
 * applies the patch, so a restyle is still one write and one undo step.
 */
export function keepingFormat(tool: AgAiTool, read: WidgetReader, widgetType: unknown): AgAiTool {
  const execute = tool.execute?.bind(tool);
  if (!execute) return tool;
  return {
    name: tool.name,
    description: tool.description,
    kind: tool.kind,
    schema: () => tool.schema(),
    execute: async (call, ctx) => {
      const filled = withKeptFormat(call, read, widgetType);
      if (!filled) return execute(call, ctx);
      return withNote(await execute(filled.call, ctx), filled.kept);
    },
  };
}

/** What the wrapper reads: the report state, through Studio's public API. */
export type StateReader = Pick<AgStudioApi, 'getState'>;

/** The widget on the page Studio's tools bind to: the agent's page, else the selected one. */
function widgetReader(api: StateReader, pageId: string | undefined): WidgetReader {
  return (widgetId) => {
    if (typeof widgetId !== 'string') return undefined;
    const state = api.getState();
    const page = state.pages.find((p) => p.id === (pageId ?? state.selectedPageId));
    const widget: unknown = page?.widgets?.[widgetId];
    return isFields(widget) ? widget : undefined;
  };
}

/** AG's Widget agent, whose restyles keep the format keys they leave out. */
export function widgetKeepingFormat(
  widget: AgAnyAiAgentDefinition,
  api: StateReader,
): AgAnyAiAgentDefinition {
  return {
    ...widget,
    instructions: (ctx, params) =>
      [widget.instructions?.(ctx, params), KEEP_FORMAT_GUIDANCE].filter(Boolean).join('\n\n'),
    tools: (ctx, params) => {
      const bound: Fields = isFields(params) ? params : {};
      const pageId = typeof bound.pageId === 'string' ? bound.pageId : undefined;
      const read = widgetReader(api, pageId);
      return (widget.tools?.(ctx, params) ?? []).map((tool) =>
        tool.name === CONFIGURE_WIDGET ? keepingFormat(tool, read, bound.widgetType) : tool,
      );
    },
  };
}
