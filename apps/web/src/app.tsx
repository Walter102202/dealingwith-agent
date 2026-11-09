import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppConfigProvider } from './api/config.js';
import { Layout } from './components/Layout.js';
import { RequireSession } from './components/RequireSession.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { MandateFundedPage } from './pages/MandateFundedPage.js';
import { PayCancelPage } from './pages/PayCancelPage.js';
import { PayReturnPage } from './pages/PayReturnPage.js';
import { ProjectPage } from './pages/ProjectPage.js';
import { StorefrontPage } from './pages/StorefrontPage.js';
import { SessionProvider } from './session.js';

/** The dashboard pulls AG Studio (several MB); it loads only when a provider opens it. */
const DashboardPage = lazy(() => import('./pages/DashboardPage.js'));

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <AppConfigProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/store" element={<StorefrontPage />} />
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
        </AppConfigProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
