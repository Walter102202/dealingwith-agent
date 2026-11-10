import type {
  AgAiAgentContext,
  AgAiHarnessBuilderContext,
  AgAiHarnessConfig,
  AgAiTool,
  AgAnyAiAgentDefinition,
  AgLlmAdapter,
} from 'ag-studio';
import { describe, expect, it, vi } from 'vitest';

vi.mock('ag-studio', async (original) => ({
  ...(await original<typeof import('ag-studio')>()),
  // Hand back the config builder so the test can run it without a live Studio.
  createAiHarness: vi.fn((_api: unknown, build: unknown) => build),
}));

import { COLLECTIONS_AGENT, leadWithCollections } from './agents.js';
import { ASSISTANT_MODELS, assistantHarness, PROMPT_STARTERS } from './harness.js';

const tool = (name: string) => ({ name }) as AgAiTool;
const definition = (id: string): AgAnyAiAgentDefinition => ({
  id,
  name: id,
  instructions: () => `You are ${id}.`,
  tools: () => [tool('view_schema'), tool('delegate_to')],
});
const builtIn = Object.fromEntries(
  ['lead', 'planning', 'data', 'page', 'widget'].map((id) => [id, definition(id)]),
) as AgAiHarnessBuilderContext['builtIn'];
const delegateTo = vi.fn((targets: readonly string[]) => tool(`delegate_to:${targets.join(',')}`));
const agentContext = { tools: { delegateTo } } as unknown as AgAiAgentContext;
const adapter: AgLlmAdapter = { executeTurn: vi.fn() };

describe('assistantHarness', () => {
  it("runs AG's five agents and Collections on our adapter, led by the lead", () => {
    const setup = assistantHarness(
      { data: () => null, providerName: () => 'Andes Data Studio' },
      adapter,
    );
    if (typeof setup !== 'function') throw new Error('expected a setup function');
    const build = setup({ api: {} as never, context: undefined }) as unknown as (
      ctx: AgAiHarnessBuilderContext,
    ) => AgAiHarnessConfig;
    const config = build({ builtIn, tools: {} as AgAiHarnessBuilderContext['tools'] });
    expect(config.primary).toBe('lead');
    expect(config.agents.map((a) => a.id)).toEqual([
      'lead',
      'planning',
      'data',
      'page',
      'widget',
      COLLECTIONS_AGENT,
    ]);
    expect(config.models).toBe(ASSISTANT_MODELS);
    expect(config.promptStarters).toBe(PROMPT_STARTERS);
    const collections = config.agents.at(-1);
    expect(collections?.name).toBe('Collections');
    expect(collections?.tools?.(agentContext, undefined).map((t) => t.name)).toEqual([
      'list_unpaid_additionals',
      'draft_payment_reminder',
    ]);
    // Reminders are signed by the provider, not by the platform.
    const instructions = collections?.instructions?.(agentContext, undefined) ?? '';
    expect(instructions).toContain('Collections agent for Andes Data Studio');
    expect(instructions).toContain('sign off with that name');
  });

  it('offers one Claude model with a fast and a thorough effort', () => {
    expect(ASSISTANT_MODELS).toEqual([
      {
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        efforts: [
          { id: 'low', label: 'Fast' },
          { id: 'medium', label: 'Thorough' },
        ],
      },
    ]);
  });
});

describe('leadWithCollections', () => {
  it('replaces the delegate tool with one that also reaches Collections and explains when', () => {
    const lead = leadWithCollections(definition('lead'));
    const tools = lead.tools?.(agentContext, undefined) ?? [];
    expect(tools.map((t) => t.name)).toEqual([
      'view_schema',
      'delegate_to:data,widget,page,planning,collections',
    ]);
    const instructions = lead.instructions?.(agentContext, undefined) ?? '';
    expect(instructions.startsWith('You are lead.')).toBe(true);
    expect(instructions).toContain("Collections delegate (type: 'collections')");
    expect(instructions).toMatch(/never write or recompute them yourself/);
  });
});
