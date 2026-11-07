import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
export function jsonBody<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: {
            code: 'validation_error',
            message: 'Request validation failed',
            details: z.flattenError(result.error),
          },
        },
        400,
      );
  });
}
export function query<T extends z.ZodType>(schema: T) {
  return zValidator('query', schema, (result, c) => {
    if (!result.success)
      return c.json(
        {
          error: {
            code: 'validation_error',
            message: 'Query validation failed',
            details: z.flattenError(result.error),
          },
        },
        400,
      );
  });
}
