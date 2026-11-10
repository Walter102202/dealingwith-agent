import { type MouseEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
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

/** Three lines, or a cross while the menu is open. */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d={open ? 'M4 4l8 8M12 4l-8 8' : 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11'} />
    </svg>
  );
}

/**
 * Provider-only, demo mode only: puts the demo back to its scripted starting
 * point from any page. On phones the button and its alert live in the menu
 * panel, so pressing it leaves the menu open and a failure reopens it
 * (`onFailure`); otherwise the alert would sit in a hidden panel.
 */
function ResetDemoButton({ onFailure }: { onFailure: () => void }) {
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
      onFailure();
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        busy={busy}
        data-menu-stays-open
        onClick={() => void reset()}
      >
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

/**
 * The phone menu's open state. It closes on Escape (focus back on the Menu
 * button), on a press outside the nav, and once an action in it is chosen,
 * except an action marked `data-menu-stays-open`, whose outcome shows in the
 * panel.
 */
function useSessionMenu(buttonId: string) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      document.getElementById(buttonId)?.focus();
    };
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && !navRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, buttonId]);
  const closeOnAction = (e: MouseEvent<HTMLElement>) => {
    const action = e.target instanceof Element ? e.target.closest('a, button') : null;
    if (action && !action.hasAttribute('data-menu-stays-open')) setOpen(false);
  };
  return {
    open,
    toggle: () => setOpen((o) => !o),
    show: () => setOpen(true),
    navRef,
    closeOnAction,
  };
}

/**
 * Header with the wordmark and the demo session; the page below it. Below
 * 600 px the session actions fold into a Menu pill (decision
 * 2026-11-10-header-menu-on-phones); wider, they sit in the pill as before.
 */
export function Layout({ children, width = 'content' }: LayoutProps) {
  const { session, status, logout } = useSession();
  const wide = width === 'wide' ? styles.wide : '';
  const buttonId = useId();
  const menuId = useId();
  const menu = useSessionMenu(buttonId);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={`${styles.bar} ${wide}`}>
          <Link to="/" className={styles.wordmark}>
            DealingWith
          </Link>
          <nav className={styles.nav} aria-label="Session" ref={menu.navRef}>
            <Button
              id={buttonId}
              variant="secondary"
              className={styles.menuButton}
              aria-expanded={menu.open}
              aria-controls={menuId}
              onClick={menu.toggle}
            >
              <MenuIcon open={menu.open} />
              Menu
            </Button>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: closes the menu after a link or button inside it is used; the controls keep their own semantics. */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation of those links and buttons fires the same click. */}
            <div
              id={menuId}
              className={`${styles.items} ${menu.open ? styles.open : ''}`}
              onClick={menu.closeOnAction}
            >
              <Link
                to="/store"
                className={`${styles.link} ${
                  session?.role === 'provider' ? styles.hideBelowTablet : ''
                }`}
              >
                Storefront
              </Link>
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
                      <ResetDemoButton onFailure={menu.show} />
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
            </div>
          </nav>
        </div>
      </header>
      <main className={`${styles.main} ${wide}`}>{children}</main>
    </div>
  );
}
