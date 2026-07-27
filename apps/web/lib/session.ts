/**
 * Stateless signed session token (SPEC §8: httpOnly, secure, 30 days).
 *
 * The cookie carries an HMAC-signed `{ sub: adminUserId, exp, ep }` payload — no
 * server-side session store. `sub` is later resolved to an admin + tenant, and
 * every downstream query is scoped by that tenant (CLAUDE.md rule 1).
 *
 * `ep` is the revocation handle. Without server-side sessions there was no way
 * to end one: a departing employee's phone stayed signed in for the full 30
 * days, and changing their password did nothing to the cookie already issued.
 * The token now pins the admin's `session_epoch`, so bumping that column
 * invalidates every token ever handed out for that admin (AUDIT.md T8).
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
  /** Session epoch this token was issued against. Absent in pre-T8 cookies. */
  ep?: number;
}

/** A verified token's claims. */
export interface SessionClaims {
  adminUserId: string;
  /**
   * Epoch the token was signed with. Cookies issued before the column existed
   * carry none and read as 0, which is the column's default — so shipping this
   * does not sign everyone out.
   */
  epoch: number;
}

/** Create a signed token for an admin user, valid for {@link MAX_AGE_SECONDS}. */
export function createSessionToken(adminUserId: string, epoch: number): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload: SessionPayload = { sub: adminUserId, exp, ep: epoch };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Verify a token and return its claims, or `null` when the signature is
 * invalid, malformed, or expired. Uses a constant-time signature compare.
 */
export function verifySessionToken(
  token: string | undefined,
): SessionClaims | null {
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
    return {
      adminUserId: parsed.sub,
      epoch: typeof parsed.ep === 'number' ? parsed.ep : 0,
    };
  } catch {
    return null;
  }
}
