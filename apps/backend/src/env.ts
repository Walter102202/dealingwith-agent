import { z } from 'zod';
import { AppError } from './lib/errors.js';

const DEFAULT_SESSION_SECRET = 'dev-session-secret-change-me';
const DEFAULT_APP_URL = 'http://localhost:3000';
const publicUrl = z.url().refine((url) => !url.endsWith('/'), 'Must not end with a slash');

export const EnvSchema = z
  .object({
    DATABASE_URL: z.string().default('pglite://.data/dev'),
    PAYPAL_MODE: z.enum(['mock', 'sandbox']).default('mock'),
    PAYPAL_CLIENT_ID: z.string().optional(),
    PAYPAL_CLIENT_SECRET: z.string().optional(),
    PAYPAL_WEBHOOK_ID: z.string().optional(),
    MOCK_WEBHOOK_SECRET: z.string().min(1).default('mock-webhook-secret'),
    LLM_PROVIDER: z.enum(['anthropic', 'openai', 'mock']).default('mock'),
    LLM_MODEL: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    /**
     * The dashboard assistant (AG Studio chat). It runs whenever ANTHROPIC_API_KEY
     * is set, whatever LLM_PROVIDER says; the quoting agent keeps its own model.
     */
    ASSISTANT_MODEL: z.string().trim().min(1).default('claude-sonnet-5-5'),
    /** Turns the assistant answers per UTC day across all visitors; 0 turns it off. */
    ASSISTANT_DAILY_TURN_LIMIT: z.coerce.number().int().min(0).default(400),
    /**
     * Public origin of the service, used for PayPal return URLs and the session
     * cookie's Secure flag. Unset, it falls back to Render's RENDER_EXTERNAL_URL
     * (the service's own https URL) and only then to the local default.
     */
    APP_URL: publicUrl.optional(),
    /**
     * Injected by Render on every web service; absent elsewhere. Not ours to
     * shape, so a trailing slash is normalised instead of refused.
     */
    RENDER_EXTERNAL_URL: z
      .url()
      .transform((url) => url.replace(/\/$/, ''))
      .optional(),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    SESSION_SECRET: z.string().min(1).default(DEFAULT_SESSION_SECRET),
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    WEB_DIST_DIR: z.string().optional(),
  })
  .transform(({ APP_URL, RENDER_EXTERNAL_URL, ...rest }) => ({
    ...rest,
    APP_URL: APP_URL ?? RENDER_EXTERNAL_URL ?? DEFAULT_APP_URL,
    ...(RENDER_EXTERNAL_URL ? { RENDER_EXTERNAL_URL } : {}),
  }))
  .superRefine((env, ctx) => {
    if (env.PAYPAL_MODE === 'sandbox') {
      for (const key of ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'] as const) {
        if (!env[key]?.trim())
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required in sandbox mode' });
      }
    }
    if (env.APP_URL.startsWith('https:') && env.SESSION_SECRET === DEFAULT_SESSION_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'Use a custom session secret for HTTPS',
      });
    }
    // A hosted service never runs behind a plain-http origin: that would mark the
    // session cookie insecure and send PayPal back to the wrong place.
    if (env.RENDER_EXTERNAL_URL && !env.APP_URL.startsWith('https:')) {
      ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'Must be https on Render' });
    }
  });
export type Env = z.infer<typeof EnvSchema>;
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // An empty value (APP_URL= in a .env, a blank field in a dashboard) means "unset".
  const defined = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = EnvSchema.safeParse(defined);
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new AppError('invalid_env', `Invalid environment variables: ${variables.join(', ')}`, {
      status: 500,
      details: { variables },
    });
  }
  return result.data;
}
