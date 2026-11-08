import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { type Role, SessionProvider, useSession } from './session.js';

/** Redirects to `/login` without a session; `as` narrows to one side of the demo. */
function RequireSession({ as, children }: { as?: Role; children: ReactNode }) {
  const { session, status } = useSession();
  if (status === 'loading') {
    return (
      <Layout>
        <p className="muted">Loading…</p>
      </Layout>
    );
  }
  if (!session || (as && session.role !== as)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Pages that later tasks replace. Kept so every route of the plan resolves from D1 on. */
function Placeholder({ name }: { name: string }) {
  return (
    <Layout>
      <h1>{name}</h1>
      <p className="muted">This page arrives in a later task.</p>
    </Layout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<Placeholder name="Storefront" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/portal/projects/:id"
            element={
              <RequireSession as="client">
                <Placeholder name="Project" />
              </RequireSession>
            }
          />
          <Route
            path="/portal/mandates/:id/funded"
            element={
              <RequireSession as="client">
                <Placeholder name="Mandate funded" />
              </RequireSession>
            }
          />
          <Route path="/pay/return" element={<Placeholder name="Payment" />} />
          <Route path="/pay/cancel" element={<Placeholder name="Payment cancelled" />} />
          <Route
            path="/dashboard"
            element={
              <RequireSession as="provider">
                <Placeholder name="Dashboard" />
              </RequireSession>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
