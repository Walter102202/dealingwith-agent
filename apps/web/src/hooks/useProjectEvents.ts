import { type DomainEvent, DomainEventSchema } from '@dealingwith/contracts';
import { useEffect, useRef } from 'react';
import { FIXTURES_MODE } from '../api/client.js';
import { routes } from '../api/routes.js';

const EVENT_TYPES: DomainEvent['type'][] = [
  'quote.published',
  'quote.needs_info',
  'quote.paid',
  'payment.approval_required',
  'mandate.updated',
];

/**
 * Subscribes to the project's server-sent events and calls `onEvent` for each
 * domain event, so the page can refetch when an agent pays. A no-op in
 * fixtures mode and where `EventSource` does not exist (jsdom).
 */
export function useProjectEvents(projectId: string, onEvent: (event: DomainEvent) => void): void {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (FIXTURES_MODE || typeof EventSource === 'undefined') return;
    const source = new EventSource(routes.events(projectId));
    const listener = (message: MessageEvent<string>) => {
      const parsed = DomainEventSchema.safeParse(JSON.parse(message.data));
      if (parsed.success) handler.current(parsed.data);
    };
    for (const type of EVENT_TYPES) source.addEventListener(type, listener);
    return () => source.close();
  }, [projectId]);
}
