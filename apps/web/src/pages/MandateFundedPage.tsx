import { MandateSchema } from '@dealingwith/contracts';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, errorMessage } from '../api/client.js';
import { routes } from '../api/routes.js';
import { Card } from '../components/Card.js';
import { Layout } from '../components/Layout.js';
import styles from './ReturnPages.module.css';

/** `/portal/mandates/:id/funded?token=<orderId>`: completes the funding authorization and returns to the project. */
export function MandateFundedPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get('token');
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(
    orderId ? null : 'This link has no PayPal order.',
  );

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    api
      .post(routes.mandates.fundComplete(id), { orderId }, MandateSchema)
      .then((mandate) => {
        if (!cancelled) void navigate(`/portal/projects/${mandate.projectId}`, { replace: true });
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, orderId, navigate]);

  return (
    <Layout>
      <div className={styles.page}>
        <Card title={error ? 'Authorization not completed' : 'Activating your agent budget'}>
          {error ? (
            <>
              <p className="error" role="alert">
                {error}
              </p>
              <p className={styles.links}>
                <Link to="/">Back to the storefront</Link>
              </p>
            </>
          ) : (
            <p className="muted">Confirming the PayPal authorization…</p>
          )}
        </Card>
      </div>
    </Layout>
  );
}
