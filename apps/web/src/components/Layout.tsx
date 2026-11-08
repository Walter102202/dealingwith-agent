import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useSession } from '../session.js';
import { Button } from './Button.js';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  /** `wide` removes the content max-width (the dashboard fills the viewport). */
  width?: 'content' | 'wide';
}

/** Header with the wordmark and the demo session; the page below it. */
export function Layout({ children, width = 'content' }: LayoutProps) {
  const { session, status, logout } = useSession();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={`${styles.bar} ${width === 'wide' ? styles.wide : ''}`}>
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
                  <Link to="/dashboard" className={styles.link}>
                    Dashboard
                  </Link>
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
      <main className={`${styles.main} ${width === 'wide' ? styles.wide : ''}`}>{children}</main>
    </div>
  );
}
