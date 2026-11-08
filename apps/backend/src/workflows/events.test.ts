import { describe, expect, test } from 'vitest';
import { quote } from '../test/policy.js';
import { createEventBus } from './events.js';

describe('createEventBus', () => {
  test('delivers despite listener errors and unsubscribes', () => {
    const bus = createEventBus();
    let count = 0;
    bus.subscribe(() => {
      throw new Error('listener failed');
    });
    const off = bus.subscribe(() => {
      count++;
    });
    const event = {
      id: '1',
      at: new Date(0).toISOString(),
      projectId: null,
      type: 'quote.published' as const,
      quote: quote(),
    };
    bus.publish(event);
    off();
    bus.publish(event);
    expect(count).toBe(1);
  });
});
