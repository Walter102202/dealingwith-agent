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
  ])('rejects invalid configuration %j', (source) => {
    expect(() => loadEnv(source)).toThrow();
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
  });
});
