import { ProjectSchema } from '@dealingwith/contracts';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { z } from 'zod';
import { api } from '../api/client.js';
import { routes } from '../api/routes.js';
import { useSession } from '../session.js';
import { REPO_URL } from './demo-quote.js';
import styles from './Landing.module.css';

const SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'for-agents', label: 'For agents' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'for-providers', label: 'For providers' },
] as const;

/** The signed-in client's first project, so "Open my project" lands where login would. */
function useClientHome(enabled: boolean): string {
  const [href, setHref] = useState('/store');
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .get(routes.projects.list, z.array(ProjectSchema))
      .then((projects) => {
        const first = projects[0];
        if (!cancelled && first) setHref(`/portal/projects/${first.id}`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return href;
}

/** Where the primary call to action goes: the demo doors, or home for whoever is signed in. */
export function useDemoCta(): { to: string; label: string } {
  const { session } = useSession();
  const clientHome = useClientHome(session?.role === 'client');
  if (session?.role === 'provider') return { to: '/dashboard', label: 'Open dashboard' };
  if (session?.role === 'client') return { to: clientHome, label: 'Open my project' };
  return { to: '/login', label: 'Try the live demo' };
}

export function LandingHeader() {
  const cta = useDemoCta();
  return (
    <header className={styles.header}>
      <div className={styles.headerBar}>
        <Link to="/" className={styles.wordmark}>
          DealingWith
        </Link>
        <nav className={styles.headerNav} aria-label="Sections">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={styles.navLink}>
              {s.label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <a href={REPO_URL} className={styles.navLink} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link to={cta.to} className={styles.ctaSmall}>
            {cta.label}
          </Link>
        </div>
      </div>
    </header>
  );
}
