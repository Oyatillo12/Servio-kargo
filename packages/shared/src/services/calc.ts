/**
 * Weight-input parsing for the bot calculator (SPEC §3.9, §4.5).
 *
 * Customers type a weight in kg — accept `3.2`, `3,2` or `3` (comma or dot
 * decimal). We store/compute in integer grams (CLAUDE.md rule 6 keeps money in
 * minor units; weight is likewise integer grams). Mirrors the admin weight rule
 * in `apps/web/app/(app)/tracks/[id]/actions.ts`.
 */

/** Reject absurd inputs — a package over 100 tonnes is a typo, not cargo. */
const MAX_KG = 100_000;

/**
 * Parse a kg weight string into integer grams, or `null` when it isn't a valid
 * non-negative number. Accepts a single comma or dot decimal separator.
 */
export function parseKgToGrams(input: string): number | null {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  // A single decimal number only: digits, optional dot, digits. No signs/exp.
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const kg = Number(trimmed);
  if (!Number.isFinite(kg) || kg < 0 || kg > MAX_KG) return null;
  return Math.round(kg * 1000);
}
