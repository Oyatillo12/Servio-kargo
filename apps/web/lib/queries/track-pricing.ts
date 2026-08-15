/**
 * Weight → price for a single track (SPEC §7.4).
 */

import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { tariffs, tenants, tracks, type Tariff } from '@kargotrack/db/schema';
import {
  chargeableWeight,
  computeTrackPrice,
  readDimensions,
} from '@kargotrack/shared';

import { getDefaultTariff } from './tariffs';

export type PricingError = 'NO_TARIFF' | 'NO_RATE';

/**
 * Set a track's weight + tariff + price (SPEC §7.4). Loads the tenant currency +
 * rate and the chosen tariff (falling back to the tenant default when none is
 * passed), then:
 *  - manual override (`priceManual`): store the admin-typed som price as-is;
 *  - otherwise recompute via `computeTrackPrice` (freezing the USD rate) on the
 *    CHARGEABLE weight — volume beats the scale for a light bulky parcel
 *    (§7.16), while `weight_grams` keeps holding what the scale said.
 * Clearing the weight clears the price. Returns an error code the action maps to
 * a message, or null on success.
 *
 * Unlike weighing, this is the deliberate-edit surface: blank dimensions here
 * CLEAR the stored ones (§7.16), because an admin who empties the fields on the
 * track page means it — the rule that an empty field never clears belongs to the
 * scanner flow, where the field is skipped rather than emptied.
 */
export async function setTrackPricing(args: {
  tenantId: string;
  trackId: string;
  weightGrams: number | null;
  /** Chosen tariff id, or null to use the tenant's default. */
  tariffId: string | null;
  priceManual: boolean;
  /** Admin-typed som price in tiyin; used only when `priceManual` + weight set. */
  manualPriceTiyin: number | null;
  /** Sides in whole cm, each null when the field was left empty (§7.16). */
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}): Promise<PricingError | null> {
  const db = getDb();

  const [tenant] = await db
    .select({ currency: tenants.currency, usdRateTiyin: tenants.usdRateTiyin })
    .from(tenants)
    .where(eq(tenants.id, args.tenantId))
    .limit(1);
  if (!tenant) return 'NO_TARIFF';

  // Resolve the tariff: explicit choice, else the tenant default.
  let tariff: Tariff | null = null;
  if (args.tariffId) {
    const [row] = await db
      .select()
      .from(tariffs)
      .where(
        and(eq(tariffs.tenantId, args.tenantId), eq(tariffs.id, args.tariffId)),
      )
      .limit(1);
    tariff = row ?? null;
  } else {
    tariff = await getDefaultTariff(args.tenantId);
  }

  // §7.16: all three sides or none — a half-measured box describes nothing.
  const dims = readDimensions(args.lengthCm, args.widthCm, args.heightCm);

  const set: Partial<typeof tracks.$inferInsert> = {
    weightGrams: args.weightGrams,
    tariffId: tariff?.id ?? null,
    priceManual: args.priceManual,
    lengthCm: dims?.lengthCm ?? null,
    widthCm: dims?.widthCm ?? null,
    heightCm: dims?.heightCm ?? null,
  };

  // The volume these sides buy at this tariff. Computed even under a manual
  // price: the customer will still ask what the box measured, and a manual
  // price on a bulky parcel is exactly when they ask.
  const charged =
    args.weightGrams == null
      ? null
      : chargeableWeight(args.weightGrams, dims, tariff?.volumetricCoef ?? null);
  set.volumetricGrams = charged?.volumetricGrams ?? null;

  if (args.weightGrams == null) {
    // No weight → no price, regardless of manual/auto.
    set.priceTiyin = null;
    set.priceUsdCents = null;
    set.usdRateUsed = null;
  } else if (args.priceManual) {
    // §7.4 manual override: keep the typed som price, no USD derivation.
    set.priceTiyin = args.manualPriceTiyin ?? null;
    set.priceUsdCents = null;
    set.usdRateUsed = null;
  } else {
    // Auto: need a tariff, and a rate when the tenant is USD.
    if (!tariff) return 'NO_TARIFF';
    if (tenant.currency === 'USD' && tenant.usdRateTiyin == null) return 'NO_RATE';
    const price = computeTrackPrice({
      weightGrams: charged?.grams ?? args.weightGrams,
      pricePerKgMinor: tariff.pricePerKgMinor,
      currency: tenant.currency,
      usdRateTiyin: tenant.usdRateTiyin,
    });
    set.priceTiyin = price.priceTiyin;
    set.priceUsdCents = price.priceUsdCents;
    set.usdRateUsed = price.usdRateUsed;
  }

  await db
    .update(tracks)
    .set(set)
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    );
  return null;
}
