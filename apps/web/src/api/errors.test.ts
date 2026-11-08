import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ApiRequestError, errorMessage } from './errors.js';

describe('errorMessage', () => {
  it('explains contract drift and logs the original error once', () => {
    const error = new ZodError([]);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(errorMessage(error)).toBe(
        'The server answered in an unexpected format. Reload the page; if it keeps happening, the app and the API are out of step.',
      );
      expect(log).toHaveBeenCalledExactlyOnceWith(error);
    } finally {
      log.mockRestore();
    }
  });

  it('keeps the API message', () => {
    expect(
      errorMessage(new ApiRequestError(403, 'forbidden', 'You cannot access this quote')),
    ).toBe('You cannot access this quote');
  });
});
