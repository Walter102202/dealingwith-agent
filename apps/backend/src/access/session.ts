import { createHmac, timingSafeEqual } from 'node:crypto';
import { type Session, SessionSchema } from '@dealingwith/contracts';
export const SESSION_COOKIE = 'dw_session';
export function signSession(
  session: Session,
  secret: string,
  options: { now: Date; ttlSeconds?: number },
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...SessionSchema.parse(session),
      exp: Math.floor(options.now.getTime() / 1000) + (options.ttlSeconds ?? 86400),
    }),
  ).toString('base64url');
  return `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function verifySession(token: string, secret: string, now: Date): Session | null {
  const parts = token.split('.');
  const payload = parts[0];
  const signature = parts[1];
  if (
    parts.length !== 2 ||
    !payload ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (
      !data ||
      typeof data !== 'object' ||
      !('exp' in data) ||
      typeof data.exp !== 'number' ||
      !Number.isFinite(data.exp) ||
      data.exp <= now.getTime() / 1000
    )
      return null;
    const session = SessionSchema.safeParse(data);
    return session.success ? session.data : null;
  } catch {
    return null;
  }
}
export function sessionCookieHeader(token: string, options: { secure: boolean }): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${options.secure ? '; Secure' : ''}`;
}
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
