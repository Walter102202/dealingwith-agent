import { createHmac } from 'node:crypto';
import type { Session } from '@dealingwith/contracts';
import { describe, expect, test } from 'vitest';
import { DEMO } from '../db/demo-data.js';
import {
  clearSessionCookieHeader,
  sessionCookieHeader,
  signSession,
  verifySession,
} from './session.js';

const now = new Date('2026-11-07T12:00:00Z');
describe('signed sessions', () => {
  test.each<Session>([
    { role: 'client', clientId: DEMO.client.id, businessId: DEMO.business.id, name: 'Mara' },
    { role: 'provider', businessId: DEMO.business.id, name: 'Andes' },
  ])('round-trips $role and rejects tampering or expiry', (s) => {
    const token = signSession(s, 'secret', { now });
    expect(verifySession(token, 'secret', now)).toEqual(s);
    const [payload, sig] = token.split('.');
    expect(
      verifySession(`${payload}.${sig?.[0] === 'A' ? 'B' : 'A'}${sig?.slice(1)}`, 'secret', now),
    ).toBeNull();
    expect(verifySession(token, 'other', now)).toBeNull();
    expect(verifySession(token, 'secret', new Date(now.getTime() + 86400000))).toBeNull();
  });
  test('rejects an invalid role even with a correct signature', () => {
    const payload = Buffer.from(
      JSON.stringify({ role: 'admin', exp: now.getTime() / 1000 + 100 }),
    ).toString('base64url');
    const signature = createHmac('sha256', 'secret').update(payload).digest('base64url');
    expect(verifySession(`${payload}.${signature}`, 'secret', now)).toBeNull();
    expect(verifySession('invalid', 'secret', now)).toBeNull();
  });
  test('uses HTTP-only same-site cookies and explicit secure mode', () => {
    expect(sessionCookieHeader('token', { secure: false })).toBe(
      'dw_session=token; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400',
    );
    expect(sessionCookieHeader('token', { secure: true })).toContain('; Secure');
    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });
});
