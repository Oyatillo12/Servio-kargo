/**
 * Stateless signed session token (SPEC §8: httpOnly, secure, 30 days).
 *
 * The cookie carries an HMAC-signed `{ sub: adminUserId, exp }` payload — no
 * server-side session store. `sub` is later resolved to an admin + tenant, and
 * every downstream query is scoped by that tenant (CLAUDE.md rule 1).
 */

import crypto from 'node:crypto';

export const COOKIE_NAME = 'kt_session';
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (SPEC §8)

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is not set (needs at least 16 chars)');
  }
  return s;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

interface SessionPayload {
  sub: string;
  exp: number;
}

/** Create a signed token for an admin user id, valid for {@link MAX_AGE_SECONDS}. */
export function createSessionToken(adminUserId: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload: SessionPayload = { sub: adminUserId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verify a token and return its admin user id, or `null` when the signature is
 * invalid, malformed, or expired. Uses a constant-time signature compare.
 */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString(),
    ) as SessionPayload;
    if (typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}
