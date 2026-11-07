import { describe, expect, test, vi } from 'vitest';
import { createLogger, redact } from './logger.js';

describe('createLogger', () => {
  test('writes one JSON line with child bindings and recursive redaction', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      createLogger({ requestId: 'r1', token: 'hidden' })
        .child({ component: 'api' })
        .info('handled', { nested: { Authorization: 'hidden' }, apiKey: 'hidden' });
      expect(write).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({
        level: 'info',
        msg: 'handled',
        requestId: 'r1',
        token: '[redacted]',
        component: 'api',
        nested: { Authorization: '[redacted]' },
        apiKey: '[redacted]',
      });
      createLogger({}, { silent: true }).child({}).error('silent');
      expect(write).toHaveBeenCalledTimes(1);
    } finally {
      write.mockRestore();
    }
  });
});
describe('redact', () => {
  test('redacts secret keys in arrays without mutating input', () => {
    const fields = {
      items: [{ PASSWORD: 'hidden', clientSecret: 'hidden', secret: 'hidden', safe: 1 }],
    };
    expect(redact(fields)).toEqual({
      items: [
        { PASSWORD: '[redacted]', clientSecret: '[redacted]', secret: '[redacted]', safe: 1 },
      ],
    });
    expect(fields.items[0]?.PASSWORD).toBe('hidden');
  });
});
