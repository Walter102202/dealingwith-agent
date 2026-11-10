import type { AppConfig, Session } from '@dealingwith/contracts';
import { ApiRequestError } from '../../errors.js';
import { BUSINESS, CLIENT, state } from '../state.js';
import { origin } from './shared.js';

export const sessionHandlers = {
  config(): AppConfig {
    return { paypalMode: 'mock', appUrl: origin(), demoMode: true, assistant: { enabled: false } };
  },

  login(role: 'client' | 'provider'): Session {
    state.session =
      role === 'client'
        ? { role, clientId: CLIENT.id, businessId: BUSINESS.id, name: CLIENT.contact }
        : { role, businessId: BUSINESS.id, name: BUSINESS.name };
    return state.session;
  },

  logout(): { ok: true } {
    state.session = null;
    return { ok: true };
  },

  me(): Session {
    if (!state.session) throw new ApiRequestError(401, 'unauthenticated', 'Sign in first');
    return state.session;
  },
};
