import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { homePath, useSession } from '../session.js';
import styles from './Landing.module.css';

/** The primary call to action; `to` is null while a client's home is still being looked up. */
export interface DemoCta {
  to: string | null;
  label: string;
}

/**
 * Where the primary call to action goes: the demo doors, or home for whoever
 * is signed in, by the same rule as sign-in (`homePath`). The landing calls it
 * once and hands the result to the header and the hero, so the projects
 * request fires once per load. If that request fails the link falls back to
 * the demo doors, where signing in resolves the project again.
 */
export function useDemoCta(): DemoCta {
  const { session } = useSession();
  const role = session?.role;
  const [clientHome, setClientHome] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'client') return;
    let cancelled = false;
    homePath('client').then(
      (path) => {
        if (!cancelled) setClientHome(path);
      },
      () => {
        if (!cancelled) setClientHome('/login');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (role === 'provider') return { to: '/dashboard', label: 'Open dashboard' };
  if (role === 'client') return { to: clientHome, label: 'Open my project' };
  return { to: '/login', label: 'Try the live demo' };
}

interface CtaLinkProps {
  cta: DemoCta;
  className: string;
}

/** The call to action as a link; while its target is unknown, a pill that cannot be followed yet. */
export function CtaLink({ cta, className }: CtaLinkProps) {
  if (cta.to === null) {
    return (
      <span className={`${className} ${styles.pillPending}`} aria-disabled="true">
        {cta.label}
      </span>
    );
  }
  return (
    <Link to={cta.to} className={className}>
      {cta.label}
    </Link>
  );
}
