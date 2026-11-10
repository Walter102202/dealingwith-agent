import { describe, expect, test } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  test('allows initial sandbox deployment before a webhook id is registered', () => {
    expect(
      loadEnv({
        PAYPAL_MODE: 'sandbox',
        PAYPAL_CLIENT_ID: 'test-client',
        PAYPAL_CLIENT_SECRET: 'test-secret',
      }),
    ).toMatchObject({ PAYPAL_MODE: 'sandbox' });
  });
  test('loads the documented local defaults', () => {
    expect(loadEnv({})).toEqual({
      DATABASE_URL: 'pglite://.data/dev',
      PAYPAL_MODE: 'mock',
      MOCK_WEBHOOK_SECRET: 'mock-webhook-secret',
      LLM_PROVIDER: 'mock',
      APP_URL: 'http://localhost:3000',
      PORT: 3000,
      SESSION_SECRET: 'dev-session-secret-change-me',
      DEMO_MODE: true,
      ASSISTANT_MODEL: 'claude-sonnet-5-5',
      ASSISTANT_DAILY_TURN_LIMIT: 400,
    });
  });
  test('requires sandbox credentials without exposing their values', () => {
    expect(() => loadEnv({ PAYPAL_MODE: 'sandbox' })).toThrow(/PAYPAL_CLIENT_ID/);
    try {
      loadEnv({ PAYPAL_MODE: 'sandbox' });
    } catch (e) {
      expect(e).toMatchObject({ code: 'invalid_env', status: 500 });
    }
  });
  test.each([
    { PORT: 'abc' },
    { APP_URL: 'https://x.example' },
    { APP_URL: 'http://localhost:3000/' },
    { DEMO_MODE: 'yes' },
    { ASSISTANT_DAILY_TURN_LIMIT: '-1' },
    { ASSISTANT_DAILY_TURN_LIMIT: 'lots' },
  ])('rejects invalid configuration %j', (source) => {
    expect(() => loadEnv(source)).toThrow();
  });
  test('on Render, APP_URL defaults to the service URL and must be https', () => {
    const render = {
      RENDER_EXTERNAL_URL: 'https://dealingwith-agent.onrender.com',
      SESSION_SECRET: 'generated-by-render',
    };
    expect(loadEnv(render)).toMatchObject({ APP_URL: 'https://dealingwith-agent.onrender.com' });
    expect(loadEnv({ ...render, APP_URL: 'https://dealingwith.si' })).toMatchObject({
      APP_URL: 'https://dealingwith.si',
    });
    expect(() => loadEnv({ ...render, APP_URL: 'http://localhost:3000' })).toThrow(/APP_URL/);
    // The forgotten dashboard field: a blank secret on a hosted service refuses to start.
    expect(() => loadEnv({ ...render, SESSION_SECRET: '' })).toThrow(/SESSION_SECRET/);
    // Render's own variable is normalised, never refused.
    expect(
      loadEnv({ ...render, RENDER_EXTERNAL_URL: `${render.RENDER_EXTERNAL_URL}/` }),
    ).toMatchObject({ APP_URL: render.RENDER_EXTERNAL_URL });
  });
  test('treats empty values as unset', () => {
    expect(loadEnv({ APP_URL: '', LLM_MODEL: '', DATABASE_URL: '' })).toMatchObject({
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'pglite://.data/dev',
    });
    expect(loadEnv({ LLM_MODEL: '' }).LLM_MODEL).toBeUndefined();
  });
  test('parses explicit values', () => {
    expect(
      loadEnv({
        PORT: '3100',
        DEMO_MODE: 'false',
        APP_URL: 'https://x.example',
        SESSION_SECRET: 'custom-secret',
      }),
    ).toMatchObject({ PORT: 3100, DEMO_MODE: false });
    expect(
      loadEnv({ ASSISTANT_MODEL: 'claude-opus-5-5', ASSISTANT_DAILY_TURN_LIMIT: '25' }),
    ).toMatchObject({ ASSISTANT_MODEL: 'claude-opus-5-5', ASSISTANT_DAILY_TURN_LIMIT: 25 });
  });
});
