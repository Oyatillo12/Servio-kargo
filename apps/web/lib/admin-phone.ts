import 'server-only';

import { PHONE_KEY_LENGTH, normalizePhone } from '@kargotrack/shared';

/**
 * Canonical storage form for an employee's phone: `+998901234567`.
 *
 * Login matches `admin_users.phone` exactly, which is fine while the only admin
 * per tenant is one the platform owner typed in — and a trap the moment an owner
 * invites a colleague: the owner writes `90 123 45 67`, the colleague types
 * `+998901234567`, and the login fails with "wrong phone or password". Writing
 * one canonical form on every new row removes the mismatch at the source.
 *
 * Returns `null` when there is no usable Uzbek number, so callers can reject the
 * input instead of storing something nobody can sign in with.
 */
export function canonicalAdminPhone(input: string): string | null {
  const key = normalizePhone(input);
  if (key == null || key.length !== PHONE_KEY_LENGTH) return null;
  return `+998${key}`;
}
