import { type ProjectView, ProjectViewSchema, QuoteSchema } from '@dealingwith/contracts';
import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { api, errorMessage } from '../api/client.js';
import { useApi } from '../api/hooks.js';
import { routes } from '../api/routes.js';
import { Card } from '../components/Card.js';
import { ConnectAgent } from '../components/ConnectAgent.js';
import { Layout } from '../components/Layout.js';
import { MandatePanel } from '../components/MandatePanel.js';
import { Money } from '../components/Money.js';
import { QuoteCard } from '../components/QuoteCard.js';
import { RequestBox } from '../components/RequestBox.js';
import { ScopeList } from '../components/ScopeList.js';
import { useProjectEvents } from '../hooks/useProjectEvents.js';
import styles from './ProjectPage.module.css';

/** `/portal/projects/:id`: the hero screen. Scope, request box, quotes, and the aside with the mandate and the agent. */
export function ProjectPage() {
  const { id = '' } = useParams();
  const fetchView = useCallback(() => api.get(routes.projects.get(id), ProjectViewSchema), [id]);
  const view = useApi(fetchView);
  const refetch = view.refetch;

  useProjectEvents(id, () => void refetch());

  const submitRequest = async (text: string) => {
    await api.post(routes.projects.requests(id), { text }, QuoteSchema);
    await refetch();
  };

  const answer = (quoteId: string) => async (answers: Record<string, string>) => {
    await api.post(routes.quotes.answers(quoteId), { answers }, QuoteSchema);
    await refetch();
  };

  if (view.error) {
    return (
      <Layout>
        <p className="error" role="alert">
          {errorMessage(view.error)}
        </p>
        <p>
          <Link to="/store">Back to the storefront</Link>
        </p>
      </Layout>
    );
  }
  if (!view.data) {
    return (
      <Layout>
        <p className="muted">Loading project…</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <ProjectBody view={view.data} onRequest={submitRequest} onAnswers={answer} onPaid={refetch} />
    </Layout>
  );
}

interface ProjectBodyProps {
  view: ProjectView;
  onRequest: (text: string) => Promise<void>;
  onAnswers: (quoteId: string) => (answers: Record<string, string>) => Promise<void>;
  onPaid: () => Promise<void>;
}

function ProjectBody({ view, onRequest, onAnswers, onPaid }: ProjectBodyProps) {
  const { project, service, quotes } = view;
  const latestOnly = quotes.filter(
    (q) => !quotes.some((other) => other.id === q.id && other.version > q.version),
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.service}>{service.name}</p>
        <h1 className={styles.title}>{project.title}</h1>
        <p className="muted">
          Contracted for <Money cents={project.totalContractedCents} /> ·{' '}
          {project.status.replace('_', ' ')}
        </p>
      </header>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Card title="Scope">
            <ScopeList clauses={project.scopeClauses} quotes={quotes} />
          </Card>

          <Card title="Ask for a change">
            <RequestBox onSubmit={onRequest} placeholder="Describe what you need" />
          </Card>

          <section className={styles.quotes} aria-live="polite">
            {latestOnly.length === 0 ? (
              <p className="muted">No quotes yet. Describe a change above to get one.</p>
            ) : (
              latestOnly.map((quote) => (
                <QuoteCard
                  key={`${quote.id}-${quote.version}`}
                  quote={quote}
                  onAccept={onPaid}
                  onAdjust={(text) => onAnswers(quote.id)({ adjustment: text })}
                  onAnswers={onAnswers(quote.id)}
                />
              ))
            )}
          </section>
        </div>

        <aside className={styles.aside} aria-label="Agent and budget">
          <Card title="Agent budget">
            <MandatePanel
              mandate={view.mandate}
              projectId={project.id}
              payments={view.payments}
              onChange={onPaid}
            />
          </Card>
          <Card title="Your agent">
            <ConnectAgent
              agents={view.agents}
              {...(view.mandate ? { mandateId: view.mandate.id } : {})}
              onChange={onPaid}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
