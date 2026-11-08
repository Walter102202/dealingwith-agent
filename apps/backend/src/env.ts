import { z } from 'zod';
import { AppError } from './lib/errors.js';

const DEFAULT_SESSION_SECRET = 'dev-session-secret-change-me';
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
    APP_URL: z
      .url()
      .refine((url) => !url.endsWith('/'), 'Must not end with a slash')
      .default('http://localhost:3000'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    SESSION_SECRET: z.string().min(1).default(DEFAULT_SESSION_SECRET),
    DEMO_MODE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    WEB_DIST_DIR: z.string().optional(),
  })
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
  });
export type Env = z.infer<typeof EnvSchema>;
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new AppError('invalid_env', `Invalid environment variables: ${variables.join(', ')}`, {
      status: 500,
      details: { variables },
    });
  }
  return result.data;
}
