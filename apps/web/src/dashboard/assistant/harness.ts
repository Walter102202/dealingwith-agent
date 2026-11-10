import {
  type AgAiHarnessSetup,
  type AgAiModel,
  type AgAiPromptStarter,
  type AgLlmAdapter,
  type AgStudioApi,
  createAiHarness,
  directLlmRunner,
} from 'ag-studio';
import { claudeAdapter } from './adapter.js';
import { type CollectionsSource, collectionsAgent, leadWithCollections } from './agents.js';
import { widgetKeepingFormat } from './keep-format.js';

/** The server owns the model; the reader picks only how hard it thinks. */
export const ASSISTANT_MODELS: AgAiModel[] = [
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    efforts: [
      { id: 'low', label: 'Fast' },
      { id: 'medium', label: 'Thorough' },
    ],
  },
];

export const PROMPT_STARTERS: AgAiPromptStarter[] = [
  {
    label: 'Who owes us?',
    prompt: 'Which clients have unpaid additionals, and how much does each one owe?',
  },
  {
    label: 'Draft a reminder',
    prompt: 'Draft a friendly payment reminder for the client with the largest unpaid balance.',
  },
  {
    label: 'Quotes pipeline',
    prompt: 'Summarise the quotes pipeline: how many quotes are in each status, and their total.',
  },
  {
    label: 'Agent vs web',
    prompt:
      'Add a chart comparing quotes created by client agents (the mcp channel) with the web channel, by status.',
  },
];

/**
 * AG's five agents on Claude, the lead able to delegate to Collections, the
 * Widget agent keeping the format keys a restyle leaves out, and Collections itself. `source` is read at call time, so the harness is built
 * once per page and never rebuilt when the data refreshes.
 */
export function assistantHarness(
  source: CollectionsSource,
  adapter: AgLlmAdapter = claudeAdapter(),
): AgAiHarnessSetup {
  return ({ api }) => {
    // AG 3.1.0 types this callback's `api` as the UI-less AgCoreStudioApi while
    // createAiHarness takes AgStudioApi; in the browser Studio passes the full API.
    const studio = api as AgStudioApi;
    return createAiHarness(studio, ({ builtIn }) => ({
      primary: 'lead',
      models: ASSISTANT_MODELS,
      promptStarters: PROMPT_STARTERS,
      agents: [
        directLlmRunner({ ...leadWithCollections(builtIn.lead), adapter }),
        directLlmRunner({ ...builtIn.planning, adapter }),
        directLlmRunner({ ...builtIn.data, adapter }),
        directLlmRunner({ ...builtIn.page, adapter }),
        directLlmRunner({ ...widgetKeepingFormat(builtIn.widget, studio), adapter }),
        collectionsAgent(adapter, source),
      ],
    }));
  };
}
