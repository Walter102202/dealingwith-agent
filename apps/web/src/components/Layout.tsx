import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { api, errorMessage } from '../api/client.js';
import { useAppConfig } from '../api/config.js';
import { routes } from '../api/routes.js';
import { reload } from '../lib/navigation.js';
import { useSession } from '../session.js';
import { Button } from './Button.js';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  /** `wide` removes the content max-width (the dashboard fills the viewport). */
  width?: 'content' | 'wide';
}

const OkSchema = z.object({ ok: z.literal(true) });

/** Provider-only, demo mode only: puts the demo back to its scripted starting point from any page. */
function ResetDemoButton() {
  const config = useAppConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!config.data?.demoMode) return null;

  const reset = async () => {
    if (!window.confirm('This restores the demo to its starting state. Continue?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(routes.demo.reset, {}, OkSchema);
      reload();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" busy={busy} onClick={() => void reset()}>
        Reset demo data
      </Button>
      {error ? (
        <span className="error small" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

/** Header with the wordmark and the demo session; the page below it. */
export function Layout({ children, width = 'content' }: LayoutProps) {
  const { session, status, logout } = useSession();
  const wide = width === 'wide' ? styles.wide : '';
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={`${styles.bar} ${wide}`}>
          <Link to="/" className={styles.wordmark}>
            DealingWith
          </Link>
          <nav className={styles.nav} aria-label="Session">
            {status === 'ready' && session ? (
              <>
                <span className={styles.who}>
                  {session.name}
                  <span className={styles.role}>{session.role}</span>
                </span>
                {session.role === 'provider' ? (
                  <>
                    <Link to="/dashboard" className={styles.link}>
                      Dashboard
                    </Link>
                    <ResetDemoButton />
                  </>
                ) : null}
                <Button variant="ghost" onClick={() => void logout()}>
                  Sign out
                </Button>
              </>
            ) : status === 'ready' ? (
              <Link to="/login" className={styles.link}>
                Demo sign in
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <main className={`${styles.main} ${wide}`}>{children}</main>
    </div>
  );
}
