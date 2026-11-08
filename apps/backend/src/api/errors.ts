import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { PaypalError } from '../integrations/paypal/gateway.js';
import { AppError } from '../lib/errors.js';
import { PricingError } from '../modules/quotes/errors.js';
import type { ApiEnv } from './auth.js';
export const onError: ErrorHandler<ApiEnv> = (error, c) => {
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(
      { error: { code: 'validation_error', message: 'Request body must be valid JSON' } },
      400,
    );
  }
  if (error instanceof z.ZodError)
    return c.json(
      {
        error: {
          code: 'validation_error',
          message: 'Request validation failed',
          details: z.flattenError(error),
        },
      },
      400,
    );
  if (error instanceof PricingError)
    return c.json(
      {
        error: {
          code: 'invalid_agent_output',
          message: 'The agent output could not be priced',
          details: error.message,
        },
      },
      422,
    );
  if (error instanceof PaypalError)
    return c.json(
      { error: { code: 'paypal_error', message: error.message, details: error.code } },
      error.status as ContentfulStatusCode,
    );
  if (error instanceof AppError)
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
      error.status as ContentfulStatusCode,
    );
  c.get('deps').logger.error('request.failed', {
    requestId: c.res.headers.get('x-request-id'),
    errorName: error.name,
  });
  return c.json(
    { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
    500,
  );
};
