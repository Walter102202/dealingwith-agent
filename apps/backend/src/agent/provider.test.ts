import { describe, expect, test } from 'vitest';
import { describeModel, getModel } from './provider.js';

describe('getModel', () => {
  test('mock needs no key and returns a model', () => {
    const model = getModel({ LLM_PROVIDER: 'mock' });
    expect(model).toBeDefined();
    expect(describeModel({ LLM_PROVIDER: 'mock' })).toEqual({
      provider: 'mock',
      model: 'mock-fixtures',
    });
  });

  test('anthropic without a key fails loudly', () => {
    expect(() => getModel({ LLM_PROVIDER: 'anthropic' })).toThrow('ANTHROPIC_API_KEY is required');
  });

  test('openai without a key fails loudly', () => {
    expect(() => getModel({ LLM_PROVIDER: 'openai' })).toThrow('OPENAI_API_KEY is required');
  });

  test('anthropic defaults to claude-opus-5-5 and LLM_MODEL overrides it', () => {
    const env = { LLM_PROVIDER: 'anthropic' as const, ANTHROPIC_API_KEY: 'test-key' };
    expect(getModel(env).modelId).toBe('claude-opus-5-5');
    expect(describeModel(env)).toEqual({ provider: 'anthropic', model: 'claude-opus-5-5' });
    expect(getModel({ ...env, LLM_MODEL: 'claude-sonnet-5-5' }).modelId).toBe('claude-sonnet-5-5');
  });

  test('openai defaults to gpt-6-astra and LLM_MODEL overrides it', () => {
    const env = { LLM_PROVIDER: 'openai' as const, OPENAI_API_KEY: 'test-key' };
    expect(getModel(env).modelId).toBe('gpt-6-astra');
    expect(getModel({ ...env, LLM_MODEL: 'gpt-6-luna' }).modelId).toBe('gpt-6-luna');
  });

  test('accepts an env whose optional fields may be undefined (Zod-inferred Env)', () => {
    const fromZod: {
      LLM_PROVIDER: 'mock';
      LLM_MODEL?: string | undefined;
      OPENAI_API_KEY?: string | undefined;
    } = { LLM_PROVIDER: 'mock', LLM_MODEL: undefined, OPENAI_API_KEY: undefined };
    expect(describeModel(fromZod).model).toBe('mock-fixtures');
  });

  test('an empty LLM_MODEL means the default', () => {
    const env = { LLM_PROVIDER: 'openai' as const, OPENAI_API_KEY: 'k', LLM_MODEL: '' };
    expect(getModel(env).modelId).toBe('gpt-6-astra');
  });
});
