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
  { id: 'for-agents', label: 'Agents' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'for-providers', label: 'Providers' },
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

/** The section the reader is in, for the nav's active pill. */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const s of SECTIONS) {
      const node = document.getElementById(s.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);
  return active;
}

/** A floating pill: wordmark, sections, the demo door. */
export function LandingHeader() {
  const cta = useDemoCta();
  const active = useActiveSection();
  return (
    <header className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Primary">
        <Link to="/" className={styles.wordmark}>
          <span className={styles.mark} aria-hidden="true" />
          DealingWith
        </Link>
        <ul className={styles.navLinks}>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={styles.navLink}
                aria-current={active === s.id ? 'location' : undefined}
              >
                {s.label}
              </a>
            </li>
          ))}
          <li>
            <a href={REPO_URL} className={styles.navLink} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </li>
        </ul>
        <Link to={cta.to} className={`${styles.pill} ${styles.pillPrimary} ${styles.pillSm}`}>
          {cta.label}
        </Link>
      </nav>
    </header>
  );
}
