/**
 * Super-admin (platform owner) auth — deliberately SEPARATE from tenant admin
 * auth (SPEC §6). A single shared secret `SUPERADMIN_TOKEN` guards the `/sa`
 * area; there are no super-admin rows in the database.
 *
 * The session cookie never stores the raw token. Instead it holds a marker =
 * HMAC(token, fixed-message), which proves the holder knew the token. The guard
 * recomputes the marker and compares in constant time.
 */

import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SA_COOKIE = 'kt_sa';
export const SA_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function superadminToken(): string {
  const t = process.env.SUPERADMIN_TOKEN;
  if (!t || t.length < 8) {
    throw new Error('SUPERADMIN_TOKEN is not set (needs at least 8 chars)');
  }
  return t;
}

/** Constant-time equality for two secrets of possibly different length. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Marker stored in the cookie — proves knowledge of the token, not the token. */
export function sessionMarker(): string {
  return crypto
    .createHmac('sha256', superadminToken())
    .update('kargotrack-superadmin-v1')
    .digest('base64url');
}

/** True when the submitted login token matches SUPERADMIN_TOKEN. */
export function tokenMatches(input: string): boolean {
  return safeEqual(input, superadminToken());
}

/** True when the current request carries a valid super-admin cookie. */
export function isSuperadmin(): boolean {
  const value = cookies().get(SA_COOKIE)?.value;
  if (!value) return false;
  return safeEqual(value, sessionMarker());
}

/** Guard for every `/sa` page and action; redirects to the token gate. */
export function requireSuperadmin(): void {
  if (!isSuperadmin()) redirect('/sa/login');
}
