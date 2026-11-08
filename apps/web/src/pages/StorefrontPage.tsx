import { type Quote, QuoteSchema, type Service, ServiceSchema } from '@dealingwith/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { api, errorMessage } from '../api/client.js';
import { useApi } from '../api/hooks.js';
import { routes } from '../api/routes.js';
import { Layout } from '../components/Layout.js';
import { QuoteCard } from '../components/QuoteCard.js';
import { RequestBox } from '../components/RequestBox.js';
import { ServiceCard } from '../components/ServiceCard.js';
import { BRAND } from '../demo-brand.js';
import { useSession } from '../session.js';
import styles from './StorefrontPage.module.css';

const fetchServices = () => api.get(routes.services, z.array(ServiceSchema));

/** `/`: the provider's services, a direct purchase, and the request box. */
export function StorefrontPage() {
  const { session, status } = useSession();
  const services = useApi(fetchServices);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isClient = session?.role === 'client';

  const createRequest = async (text: string) => {
    const result = await api.post(routes.requests.create, { text }, QuoteSchema);
    setQuote(result);
  };

  const answer = async (quoteId: string, answers: Record<string, string>) => {
    setQuote(await api.post(routes.quotes.answers(quoteId), { answers }, QuoteSchema));
  };

  /** The quote was paid in place (zero total or sandbox capture): show its paid version. */
  const refreshQuote = async (current: Quote) => {
    setQuote(await api.get(routes.quotes.get(current.id, current.version), QuoteSchema));
  };

  const buy = async (service: Service) => {
    setBuying(service.id);
    setError(null);
    try {
      await createRequest(`Buy ${service.name}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBuying(null);
    }
  };

  return (
    <Layout>
      <section className={styles.hero}>
        <h1 className={styles.title}>{BRAND.name}</h1>
        <p className={styles.tagline}>{BRAND.tagline}</p>
        <p className="muted small">{BRAND.location} · Billing in USD</p>
      </section>

      {status === 'ready' && !isClient ? (
        <p className={styles.notice}>
          To buy or ask for a quote, <Link to="/login">enter as the demo client</Link>.
        </p>
      ) : null}

      {services.error ? (
        <p className="error" role="alert">
          {errorMessage(services.error)}
        </p>
      ) : null}
      {services.loading && !services.data ? <p className="muted">Loading services…</p> : null}

      {services.data ? (
        <div className={styles.grid}>
          {services.data.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              busy={buying === service.id}
              {...(isClient ? { onBuy: (s: Service) => void buy(s) } : {})}
            />
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.ask}>
        <h2>Need something else?</h2>
        <p className="muted">
          Describe it in plain language. The agent reads it against the published services and
          answers with a priced quote you can pay right here.
        </p>
        {isClient ? (
          <RequestBox onSubmit={createRequest} placeholder="Describe what you need" />
        ) : null}
      </section>

      {quote ? (
        <section className={styles.result} aria-live="polite">
          <QuoteCard
            quote={quote}
            onAccept={() => refreshQuote(quote)}
            onAdjust={(text) => answer(quote.id, { adjustment: text })}
            onAnswers={(answers) => answer(quote.id, answers)}
          />
        </section>
      ) : null}
    </Layout>
  );
}
