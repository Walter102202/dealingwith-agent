import { ZodError } from 'zod';

/** A non-2xx API response, built from the contracts `ApiError` envelope. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

/** The message to show a person for any failure the UI catches. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof ZodError) {
    console.error(error);
    return 'The server answered in an unexpected format. Reload the page; if it keeps happening, the app and the API are out of step.';
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
