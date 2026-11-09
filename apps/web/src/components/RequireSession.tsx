import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { type Role, useSession } from '../session.js';
import { Layout } from './Layout.js';

/** Redirects to `/login` without a session; `as` narrows to one side of the demo. */
export function RequireSession({ as, children }: { as?: Role; children: ReactNode }) {
  const { session, status } = useSession();
  if (status === 'loading') {
    return (
      <Layout>
        <p className="muted">Loading…</p>
      </Layout>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (as && session.role !== as) {
    return <Navigate to={session.role === 'provider' ? '/dashboard' : '/store'} replace />;
  }
  return <>{children}</>;
}
