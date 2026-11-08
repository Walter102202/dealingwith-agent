import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '@dealingwith/contracts';
import { createLogger } from '../observability/logger.js';
export type EventBus = {
  publish(event: DomainEvent): void;
  subscribe(listener: (event: DomainEvent) => void): () => void;
};
export function createEventBus(): EventBus {
  const listeners = new Set<(event: DomainEvent) => void>();
  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          createLogger().warn('event.listener_failed', { eventId: event.id });
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
type EventFields = DomainEvent extends infer E
  ? E extends DomainEvent
    ? Omit<E, 'id' | 'at'>
    : never
  : never;
export function makeEvent(deps: { now: () => Date }, fields: EventFields): DomainEvent {
  return { ...fields, id: randomUUID(), at: deps.now().toISOString() };
}
