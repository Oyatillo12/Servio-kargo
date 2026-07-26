/**
 * Display formatters (SPEC §4 formatting rules, §7.9).
 *
 * - Money is stored as integer tiyin (1 so'm = 100 tiyin, CLAUDE.md rule 6).
 *   Displayed as whole so'm with space thousands separators + ` so'm` suffix
 *   (the suffix is added by the i18n templates, not here).
 * - Weight is stored as integer grams; displayed in kg with up to 2 decimals.
 * - Timestamps are stored in UTC; displayed as DD.MM.YYYY in Asia/Tashkent.
 */

const DISPLAY_TZ = 'Asia/Tashkent';

/**
 * Format an integer tiyin amount as grouped so'm, e.g. `125_000_000` (tiyin)
 * → `"1 250 000"`. Rounds to the nearest whole so'm. Negative inputs keep the
 * sign, but callers that distinguish debt vs. advance should pass `Math.abs`.
 */
export function formatSom(tiyin: number): string {
  const som = Math.round(tiyin / 100);
  const sign = som < 0 ? '-' : '';
  const digits = Math.abs(som).toString();
  // Insert a space every 3 digits from the right.
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${grouped}`;
}

/**
 * Format an integer grams weight as kg with up to 2 decimals, trailing zeros
 * trimmed: `1500` → `"1.5"`, `25000` → `"25"`, `300` → `"0.3"`, `1236` → `"1.24"`.
 */
export function formatKg(grams: number): string {
  const kg = grams / 1000;
  // toFixed(2) then strip trailing zeros and a dangling dot.
  return kg
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace(/\.$/, '');
}

/**
 * Format an integer USD-cents amount as `$` with one decimal when needed
 * (SPEC §4 formatting): `350` → `"3.5$"`, `300` → `"3$"`, `355` → `"3.55$"`.
 * Trailing zeros are trimmed to at most 2 decimals.
 */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  const text = dollars
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace(/\.$/, '');
  return `${text}$`;
}

/** Format a Date as `DD.MM.YYYY` in the Asia/Tashkent display timezone. */
export function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

/**
 * Format a Date as `DD.MM.YYYY HH:mm` in Asia/Tashkent — the audit timeline and
 * the Excel export both need the time, not just the date (§7.9).
 */
export function formatDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DISPLAY_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}
