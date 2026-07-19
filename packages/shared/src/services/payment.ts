/**
 * Payment amount parsing (SPEC §5.5: "To'lov qo'shish — summa so'mda").
 *
 * Admins enter a payment in whole so'm; money is stored as integer tiyin
 * (1 so'm = 100 tiyin, CLAUDE.md rule 6 — never floats). Pure + tested so the
 * money conversion has a single, verified home.
 */

/**
 * Parse a user-entered so'm amount into integer tiyin. Accepts thousands
 * separators the admin might type (spaces, apostrophes, underscores). Only a
 * positive whole so'm amount is valid; anything else (0, negative, decimals,
 * non-numeric, unsafe magnitude) returns `null`.
 *
 * Examples: `"1 250 000"` → `125_000_000`; `"12"` → `1_200`;
 * `"0"` / `"-5"` / `"1.5"` / `"abc"` → `null`.
 */
export function parseSomToTiyin(input: string): number | null {
  const cleaned = input.replace(/[\s'_]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const som = Number(cleaned);
  if (!Number.isSafeInteger(som) || som <= 0) return null;
  return som * 100;
}

/**
 * Parse a user-entered USD amount (dollars, up to 2 decimals) into integer
 * cents — used for USD-tenant tariff prices (SPEC §7.4). Accepts `.`/`,` as the
 * decimal mark and thousands separators. Only a positive amount is valid.
 *
 * Examples: `"3.5"` → `350`; `"12"` → `1200`; `"3,55"` → `355`;
 * `"0"` / `"-1"` / `"1.234"` / `"abc"` → `null`.
 */
export function parseUsdToCents(input: string): number | null {
  const cleaned = input.replace(/[\s'_]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const dollars = Number(cleaned);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return Math.round(dollars * 100);
}
