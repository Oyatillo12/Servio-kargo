/**
 * Login throttling rules (AUDIT.md T9, SPEC §8 hardening).
 *
 * Fixed-window counting: every attempt bumps a per-key counter in
 * `auth_throttle`; once the counter passes the rule's ceiling the caller
 * rejects with a generic "too many attempts" until the window expires. The
 * atomic bump itself is SQL (apps/web `bumpThrottle`) — this module owns the
 * rules, the key shapes and the verdict, so both are testable without a DB.
 *
 * Two keys per panel login: the phone (stops a distributed guess against one
 * account) and the caller IP (stops one box spraying many accounts). The IP
 * ceiling is higher — several admins of one cargo may share an office NAT.
 */

export interface ThrottleRule {
  windowSeconds: number;
  maxAttempts: number;
}

/** Per-phone ceiling on /login. */
export const LOGIN_PHONE_THROTTLE: ThrottleRule = {
  windowSeconds: 15 * 60,
  maxAttempts: 10,
};

/** Per-IP ceiling on /login (shared office NAT → looser than per-phone). */
export const LOGIN_IP_THROTTLE: ThrottleRule = {
  windowSeconds: 15 * 60,
  maxAttempts: 30,
};

/** Per-IP ceiling on invite redemption — the 6-char code IS the secret. */
export const INVITE_IP_THROTTLE: ThrottleRule = {
  windowSeconds: 15 * 60,
  maxAttempts: 15,
};

/** Per-IP ceiling on /sa/login — one token, no legitimate retry storm. */
export const SA_LOGIN_THROTTLE: ThrottleRule = {
  windowSeconds: 15 * 60,
  maxAttempts: 5,
};

/** Per-IP ceiling on the Mini App's public track lookup (tasks.md B6) —
 * generous for a human re-checking a parcel, hostile to enumeration. */
export const PUBLIC_LOOKUP_THROTTLE: ThrottleRule = {
  windowSeconds: 15 * 60,
  maxAttempts: 30,
};

export type ThrottleScope = 'login' | 'invite' | 'sa' | 'ip' | 'lookup';

/**
 * Canonical `auth_throttle.key`. The identifier is trimmed and lowercased so
 * "+998 90…" typed with different spacing lands on one counter; an absent
 * identifier (no XFF header in dev) still throttles under a shared bucket
 * rather than not at all.
 */
export function throttleKey(scope: ThrottleScope, identifier: string | null | undefined): string {
  const id = identifier?.trim().toLowerCase().replace(/\s+/g, '') || 'unknown';
  return `${scope}:${id}`;
}

/** Verdict for the count `bumpThrottle` returned for this attempt. */
export function isThrottled(count: number, rule: ThrottleRule): boolean {
  return count > rule.maxAttempts;
}
