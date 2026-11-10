import { ProjectSchema, type Session, SessionSchema } from '@dealingwith/contracts';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiRequestError, api } from './api/client.js';
import { routes } from './api/routes.js';

export type Role = Session['role'];

export interface SessionState {
  session: Session | null;
  status: 'loading' | 'ready';
  /** Signs in as the demo client or provider and lands on their home page. */
  loginAs: (role: Role) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Where a signed-in role belongs: the provider's dashboard, or the client's
 * first project (the storefront when there is none). Sign-in and the landing's
 * call to action both use it, so they land in the same place.
 */
export async function homePath(role: Role): Promise<string> {
  if (role === 'provider') return '/dashboard';
  const projects = await api.get(routes.projects.list, z.array(ProjectSchema));
  const first = projects[0];
  return first ? `/portal/projects/${first.id}` : '/store';
}

const SessionContext = createContext<SessionState | null>(null);

const OkSchema = z.object({ ok: z.literal(true) });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api
      .get(routes.session.me, SessionSchema)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e: unknown) => {
        if (!(e instanceof ApiRequestError && e.status === 401)) console.error(e);
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loginAs = useCallback(
    async (role: Role) => {
      const s = await api.post(routes.session.login, { role }, SessionSchema);
      setSession(s);
      void navigate(await homePath(s.role));
    },
    [navigate],
  );

  const logout = useCallback(async () => {
    await api.post(routes.session.logout, {}, OkSchema);
    setSession(null);
    void navigate('/login');
  }, [navigate]);

  return (
    <SessionContext.Provider value={{ session, status, loginAs, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
