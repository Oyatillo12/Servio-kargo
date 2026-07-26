/**
 * Weight → price for a single track (SPEC §7.4).
 */

import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { tariffs, tenants, tracks, type Tariff } from '@kargotrack/db/schema';
import { computeTrackPrice } from '@kargotrack/shared';

import { getDefaultTariff } from './tariffs';

export type PricingError = 'NO_TARIFF' | 'NO_RATE';

/**
 * Set a track's weight + tariff + price (SPEC §7.4). Loads the tenant currency +
 * rate and the chosen tariff (falling back to the tenant default when none is
 * passed), then:
 *  - manual override (`priceManual`): store the admin-typed som price as-is;
 *  - otherwise recompute via `computeTrackPrice` (freezing the USD rate).
 * Clearing the weight clears the price. Returns an error code the action maps to
 * a message, or null on success.
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

  const set: Partial<typeof tracks.$inferInsert> = {
    weightGrams: args.weightGrams,
    tariffId: tariff?.id ?? null,
    priceManual: args.priceManual,
  };

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
      weightGrams: args.weightGrams,
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
