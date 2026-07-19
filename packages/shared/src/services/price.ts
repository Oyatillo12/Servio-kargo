/**
 * Price calculation (SPEC §7.4).
 *
 * Amounts are integer minor units — never floats for money (CLAUDE.md rule 6).
 * A tenant is priced in UZS or USD:
 *  - UZS: the tariff's `price_per_kg_minor` is tiyin;
 *    `price_tiyin = round(weight_grams * price_per_kg_tiyin / 1000)`.
 *  - USD: the tariff's `price_per_kg_minor` is cents;
 *    `price_usd_cents = round(weight_grams * price_per_kg_cents / 1000)`,
 *    then the som price is FROZEN at weighing time via the tenant's rate:
 *    `price_tiyin = round(price_usd_cents * usd_rate_tiyin / 100)`, storing
 *    `usd_rate_used` so later kurs changes never alter existing tracks.
 */

export type Currency = 'UZS' | 'USD';

/**
 * Legacy UZS-only helper kept for callers/tests that pre-date currency support:
 * `price_tiyin = round(weight_grams * price_per_kg_tiyin / 1000)`.
 */
export function priceForGrams(
  weightGrams: number,
  pricePerKgTiyin: number,
): number {
  return Math.round((weightGrams * pricePerKgTiyin) / 1000);
}

export interface TrackPriceInput {
  weightGrams: number;
  /** Tariff price per kg in minor units (tiyin if UZS, cents if USD). */
  pricePerKgMinor: number;
  currency: Currency;
  /** Som per 1 USD in tiyin. Required (non-null) when `currency` is 'USD'. */
  usdRateTiyin: number | null;
}

export interface TrackPrice {
  /** Som price in tiyin — always populated, frozen for USD tenants. */
  priceTiyin: number;
  /** USD price in cents — set only for USD tenants, else null. */
  priceUsdCents: number | null;
  /** The som-per-USD rate frozen onto the track — USD only, else null. */
  usdRateUsed: number | null;
}

/**
 * Compute a track's price from its weight + tariff under the tenant's currency
 * (SPEC §7.4). For USD tenants the som figure is frozen using `usdRateTiyin`,
 * which is also returned as `usdRateUsed` for storage. Throws if a USD tenant has
 * no rate configured — callers validate the rate before weighing.
 */
export function computeTrackPrice(input: TrackPriceInput): TrackPrice {
  if (input.currency === 'USD') {
    if (input.usdRateTiyin == null) {
      throw new Error('computeTrackPrice: USD currency requires usdRateTiyin');
    }
    const priceUsdCents = Math.round(
      (input.weightGrams * input.pricePerKgMinor) / 1000,
    );
    const priceTiyin = Math.round((priceUsdCents * input.usdRateTiyin) / 100);
    return { priceTiyin, priceUsdCents, usdRateUsed: input.usdRateTiyin };
  }

  const priceTiyin = Math.round(
    (input.weightGrams * input.pricePerKgMinor) / 1000,
  );
  return { priceTiyin, priceUsdCents: null, usdRateUsed: null };
}
