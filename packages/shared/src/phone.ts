/**
 * Phone normalization for customer matching (SPEC §7.12).
 *
 * Customers reach us through three different doors and each one spells the same
 * number differently: Telegram's `contact.phone_number` (`998901234567`), an
 * admin typing it from a paper list (`+998 90 123-45-67`), and an Excel import
 * (`901234567`). To recognise them as one person we store a `phone_normalized`
 * key alongside the raw `phone` and match on the key only.
 *
 * Rule: keep digits, then take the LAST 9 — the Uzbek national number length,
 * which drops the `+998` / `998` / `8` prefixes that vary by source. Shorter
 * inputs are kept whole. The SQL backfill in migration 0006 is the same
 * expression (`right(regexp_replace(phone,'\D','','g'), 9)`), so a row written
 * by the app and a row written by the migration always agree.
 */

/** Uzbek national number length — the comparable tail of any UZ phone. */
export const PHONE_KEY_LENGTH = 9;

/**
 * Reduce a raw phone to its comparison key, or `null` when there is nothing
 * comparable (empty/blank input, or no digits at all).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (digits.length === 0) return null;
  return digits.length > PHONE_KEY_LENGTH
    ? digits.slice(-PHONE_KEY_LENGTH)
    : digits;
}

/** Two raw phones belong to the same person when their keys match (never on null). */
export function samePhone(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = normalizePhone(a);
  const kb = normalizePhone(b);
  return ka != null && ka === kb;
}
