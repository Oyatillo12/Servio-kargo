/**
 * Mini App customer session (tasks.md B1). Same stateless signed-cookie idea
 * as the admin session (`lib/session.ts`), but a SEPARATE cookie with a
 * domain-separated signature: a TWA token must never verify as an admin
 * token or vice versa, even though both use SESSION_SECRET. The HMAC input
 * is prefixed with a context string, so the two token families are
 * cryptographically disjoint.
 *
 * The token pins BOTH tenant and customer: a cookie issued inside tenant A's
 * Mini App is rejected on tenant B's paths.
 */

import crypto from 'node:crypto';

export const TWA_COOKIE_NAME = 'sk_twa';

/** 7 days — re-opening the Mini App re-validates initData cheaply anyway. */
export const TWA_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const SIGN_CONTEXT = 'twa1:';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is not set (needs at least 16 chars)');
  }
  return s;
}

function sign(data: string): string {
  return crypto
    .createHmac('sha256', secret())
    .update(SIGN_CONTEXT + data)
    .digest('base64url');
}

interface TwaSessionPayload {
  /** Tenant id the Mini App belongs to. */
  t: string;
  /** Customer id within that tenant. */
  c: string;
  exp: number;
}

export interface TwaSessionClaims {
  tenantId: string;
  customerId: string;
}

export function createTwaSessionToken(
  tenantId: string,
  customerId: string,
): string {
  const exp = Math.floor(Date.now() / 1000) + TWA_MAX_AGE_SECONDS;
  const payload: TwaSessionPayload = { t: tenantId, c: customerId, exp };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/** Verify a token; `null` on any defect (bad signature, malformed, expired). */
export function verifyTwaSessionToken(
  token: string | undefined,
): TwaSessionClaims | null {
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
    ) as TwaSessionPayload;
    if (
      typeof parsed.t !== 'string' ||
      typeof parsed.c !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (parsed.exp * 1000 < Date.now()) return null;
    return { tenantId: parsed.t, customerId: parsed.c };
  } catch {
    return null;
  }
}
