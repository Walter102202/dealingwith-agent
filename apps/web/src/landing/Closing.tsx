import { connectionSnippets } from '@dealingwith/contracts';
import { useState } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/client.js';
import { CopyField } from '../components/CopyField.js';
import { type Role, useSession } from '../session.js';
import styles from './Closing.module.css';
import { MCP_GUIDE_URL, REPO_URL } from './demo-quote.js';
import base from './Landing.module.css';
import { Reveal } from './Reveal.js';

/** The token placeholder in the install command; the real one comes from "Connect my agent". */
const TOKEN_PLACEHOLDER = 'dwa_…';

interface RoleDoorProps {
  as: Role;
  who: string;
  what: string;
  go: string;
  busy: boolean;
  onEnter: (role: Role) => void;
}

/** A demo door that signs straight in as its role, as the login page would. */
function RoleDoor({ as: role, who, what, go, busy, onEnter }: RoleDoorProps) {
  return (
    <button
      type="button"
      className={styles.door}
      onClick={() => onEnter(role)}
      disabled={busy}
      aria-busy={busy || undefined}
    >
      <span className={styles.doorWho}>{who}</span>
      <span className={styles.doorWhat}>{what}</span>
      <span className={styles.doorGo}>{go}</span>
    </button>
  );
}

export function TryIt() {
  const { loginAs } = useSession();
  const [entering, setEntering] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const origin = typeof window === 'undefined' ? 'https://dealingwith.si' : window.location.origin;
  const install = connectionSnippets({ appUrl: origin, token: TOKEN_PLACEHOLDER }).claudeCode;

  const enter = (role: Role) => {
    setEntering(role);
    setError(null);
    loginAs(role).catch((e: unknown) => {
      setError(errorMessage(e));
      setEntering(null);
    });
  };

  return (
    <section className={`${base.section} ${styles.invite}`} aria-labelledby="try-title">
      <div className={base.container}>
        <Reveal>
          <h2 id="try-title" className={`${base.display} ${styles.inviteTitle}`}>
            Try it in two minutes.
          </h2>
        </Reveal>
        <Reveal as="p" className={styles.inviteLead} delay={1}>
          No password. Pick a side of the deal; reset the demo any time from the provider header.
        </Reveal>
        <div className={styles.doors}>
          <Reveal delay={1}>
            <RoleDoor
              as="client"
              who="Mara, the client"
              what="Ask for a change, see what is included, pay the extra, connect your agent."
              go="Enter as Mara →"
              busy={entering !== null}
              onEnter={enter}
            />
          </Reveal>
          <Reveal delay={2}>
            <RoleDoor
              as="provider"
              who="Andes Data Studio, the provider"
              what="Revenue, the quote pipeline and unpaid extras on the AG Studio dashboard."
              go="Enter as provider →"
              busy={entering !== null}
              onEnter={enter}
            />
          </Reveal>
          <Reveal delay={3}>
            <Link to="/store" className={styles.door}>
              <span className={styles.doorWho}>The storefront</span>
              <span className={styles.doorWhat}>
                The demo business’s services, with a fixed-price purchase you can pay right away.
              </span>
              <span className={styles.doorGo}>Browse the storefront →</span>
            </Link>
          </Reveal>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <Reveal className={styles.install} delay={1}>
          <CopyField
            label="Or connect Claude Code (the token comes from “Connect my agent”)"
            value={install}
            multiline
          />
          <a href={MCP_GUIDE_URL} target="_blank" rel="noreferrer" className={base.textLink}>
            Read the MCP guide
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${base.container} ${styles.footerInner}`}>
        <span className={base.wordmark}>
          <span className={base.mark} aria-hidden="true" />
          DealingWith
        </span>
        <span>Built for the PayPal AI Hackathon 2026 · MIT license</span>
        <nav className={styles.footerLinks} aria-label="Project">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <a href={MCP_GUIDE_URL} target="_blank" rel="noreferrer">
            MCP guide
          </a>
        </nav>
      </div>
    </footer>
  );
}
