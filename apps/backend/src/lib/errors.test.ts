import { describe, expect, test } from 'vitest';
import { AppError, isAppError, notFound } from './errors.js';

describe('AppError', () => {
  test('preserves machine and human context', () => {
    const cause = new Error('underlying');
    const error = new AppError('conflict', 'Conflict', {
      status: 409,
      details: { version: 2 },
      cause,
    });
    expect(error).toMatchObject({
      code: 'conflict',
      message: 'Conflict',
      status: 409,
      details: { version: 2 },
      cause,
    });
    expect(isAppError(error)).toBe(true);
    expect(isAppError(cause)).toBe(false);
    expect(new AppError('bad', 'Bad').status).toBe(400);
  });
});
describe('notFound', () => {
  test('identifies the missing entity', () => {
    expect(notFound('quote', 'q1')).toMatchObject({
      code: 'quote_not_found',
      status: 404,
      message: 'Quote q1 not found',
    });
  });
});
