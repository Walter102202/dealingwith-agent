import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ApiRequestError, errorMessage } from './errors.js';

describe('errorMessage', () => {
  it('explains contract drift without side effects (it runs during render)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(errorMessage(new ZodError([]))).toBe(
        'The server answered in an unexpected format. Reload the page; if it keeps happening, the app and the API are out of step.',
      );
      expect(log).not.toHaveBeenCalled();
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
