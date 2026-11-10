import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CtaLink, type DemoCta } from './cta.js';
import { REPO_URL } from './demo-quote.js';
import base from './Landing.module.css';
import styles from './LandingHeader.module.css';

const SECTIONS = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'for-agents', label: 'Agents' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'for-providers', label: 'Providers' },
] as const;

/**
 * The section the reader is in, for the nav's active pill: the first section,
 * in page order, that crosses the band near the middle of the viewport. Null
 * above the first one (the hero) and below the last (the invitation, the
 * footer).
 */
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        setActive(SECTIONS.find((s) => inBand.has(s.id))?.id ?? null);
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
export function LandingHeader({ cta }: { cta: DemoCta }) {
  const active = useActiveSection();
  return (
    <header className={styles.navWrap}>
      <nav className={styles.nav} aria-label="Primary">
        <Link to="/" className={base.wordmark}>
          <span className={base.mark} aria-hidden="true" />
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
        <CtaLink cta={cta} className={`${base.pill} ${base.pillPrimary} ${base.pillSm}`} />
      </nav>
    </header>
  );
}
