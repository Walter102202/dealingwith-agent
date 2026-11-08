import { lazy, type ReactNode, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { MandateFundedPage } from './pages/MandateFundedPage.js';
import { PayCancelPage } from './pages/PayCancelPage.js';
import { PayReturnPage } from './pages/PayReturnPage.js';
import { ProjectPage } from './pages/ProjectPage.js';
import { StorefrontPage } from './pages/StorefrontPage.js';
import { type Role, SessionProvider, useSession } from './session.js';

/** The dashboard pulls AG Studio (several MB); it loads only when a provider opens it. */
const DashboardPage = lazy(() => import('./pages/DashboardPage.js'));

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

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<StorefrontPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/portal/projects/:id"
            element={
              <RequireSession as="client">
                <ProjectPage />
              </RequireSession>
            }
          />
          <Route
            path="/portal/mandates/:id/funded"
            element={
              <RequireSession as="client">
                <MandateFundedPage />
              </RequireSession>
            }
          />
          <Route path="/pay/return" element={<PayReturnPage />} />
          <Route path="/pay/cancel" element={<PayCancelPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireSession as="provider">
                <Suspense
                  fallback={
                    <Layout>
                      <p className="muted">Loading dashboard…</p>
                    </Layout>
                  }
                >
                  <DashboardPage />
                </Suspense>
              </RequireSession>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
