import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { findFixture } from './mock-fixtures.js';

export type LlmProvider = 'anthropic' | 'openai' | 'mock';

/** A model object (never the `"provider/model"` gateway string, which needs a Vercel gateway key). */
export type ModelObject = Exclude<LanguageModel, string>;

/** The slice of the environment the agent reads (spec section 7.3). */
export type LlmEnv = {
  LLM_PROVIDER: LlmProvider;
  LLM_MODEL?: string | undefined;
  ANTHROPIC_API_KEY?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
};

export const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5',
  mock: 'mock-fixtures',
};

/** Provider and model name as recorded in `agent_runs`. */
export function describeModel(env: LlmEnv): { provider: LlmProvider; model: string } {
  const override = env.LLM_MODEL?.trim();
  return {
    provider: env.LLM_PROVIDER,
    model: env.LLM_PROVIDER === 'mock' || !override ? DEFAULT_MODELS[env.LLM_PROVIDER] : override,
  };
}

/**
 * The language model for the configured provider. Claude and OpenAI share the
 * same calling code through the AI SDK; `mock` answers from the fixtures and
 * needs no key, which is what CI and the scenario tests run.
 */
export function getModel(env: LlmEnv): ModelObject {
  const { model } = describeModel(env);
  switch (env.LLM_PROVIDER) {
    case 'anthropic': {
      const apiKey = requireKey(env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY');
      return createAnthropic({ apiKey })(model);
    }
    case 'openai': {
      const apiKey = requireKey(env.OPENAI_API_KEY, 'OPENAI_API_KEY');
      return createOpenAI({ apiKey })(model);
    }
    case 'mock':
      return createMockModel();
  }
}

function requireKey(value: string | undefined, name: string): string {
  const key = value?.trim();
  if (!key) {
    throw new Error(
      `${name} is required when LLM_PROVIDER is ${name.split('_')[0]?.toLowerCase()}`,
    );
  }
  return key;
}

const NO_FIXTURE = JSON.stringify({
  error: 'no fixture matches this request; the mock provider only knows the five demo requests',
});

/**
 * A model that answers with the fixture whose `match` hits the user message.
 * When nothing matches it returns a JSON object that fails the output schema,
 * so the run ends as `invalid_output` exactly like a misbehaving real model.
 */
export function createMockModel(): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: DEFAULT_MODELS.mock,
    doGenerate: async ({ prompt }) => {
      const userText = prompt
        .filter((message) => message.role === 'user')
        .flatMap((message) => message.content)
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('\n');
      const fixture = findFixture(requestSection(userText));
      const text = fixture ? JSON.stringify(fixture.output) : NO_FIXTURE;
      return {
        content: [{ type: 'text', text }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: {
          inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 0, text: 0, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
}

/** Only the request (and answers) part of the prompt, so the rendered catalog never matches a fixture. */
function requestSection(userText: string): string {
  const index = userText.indexOf('# Request');
  return index === -1 ? userText : userText.slice(index);
}
