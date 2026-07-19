/**
 * Price calculation (SPEC §7.4).
 *
 * `price_tiyin = round(weight_grams * price_per_kg_tiyin / 1000)`.
 * Recomputed whenever weight changes. Both inputs and the result are integer
 * tiyin / grams — never floats for money (CLAUDE.md rule 6).
 */
export function priceForGrams(
  weightGrams: number,
  pricePerKgTiyin: number,
): number {
  return Math.round((weightGrams * pricePerKgTiyin) / 1000);
}
