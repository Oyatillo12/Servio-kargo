/** Staff weighing at the China warehouse (SPEC §3.8, pricing per §7.4). */

import { and, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification } from '@kargotrack/db/queue';
import {
  trackEvents,
  tracks,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';
import { computeTrackPrice, planStaffWeighing } from '@kargotrack/shared';

import { isUniqueViolation } from './internal';
import { getDefaultTariff } from './tenants';
import { findTrackByCode } from './tracks';

/** Weighing outcome: NO_RATE means a USD tenant has no kurs set — can't price. */
export type StaffWeighingResult =
  | { ok: true; track: Track; created: boolean }
  | { ok: false; reason: 'NO_RATE' };

/**
 * Apply a staff weighing (SPEC §3.8): set a track's weight + auto price (§7.4,
 * via the tenant's default tariff) and, for a track still in CREATED, advance it
 * to CHINA_WAREHOUSE with an event + customer notification. An unknown code is
 * created unattached (customer_id NULL) directly in CHINA_WAREHOUSE so a client
 * can claim it later. Every query is tenant-scoped (CLAUDE.md rule 1).
 */
export async function applyStaffWeighing(args: {
  tenant: Tenant;
  codeNormalized: string;
  codeOriginal: string;
  weightGrams: number;
  createdBy: string;
}): Promise<StaffWeighingResult> {
  const { tenant, weightGrams } = args;

  // §7.4 auto pricing; a USD tenant with no kurs can't be priced (mirrors the
  // panel's setTrackPricing / calculator guard).
  if (tenant.currency === 'USD' && tenant.usdRateTiyin == null) {
    return { ok: false, reason: 'NO_RATE' };
  }
  const tariff = await getDefaultTariff(tenant.id);
  const price = computeTrackPrice({
    weightGrams,
    pricePerKgMinor: tariff?.pricePerKgMinor ?? 0,
    currency: tenant.currency,
    usdRateTiyin: tenant.usdRateTiyin,
  });
  const pricing = {
    weightGrams,
    tariffId: tariff?.id ?? null,
    priceTiyin: price.priceTiyin,
    priceUsdCents: price.priceUsdCents,
    usdRateUsed: price.usdRateUsed,
    priceManual: false,
  };

  const existing = await findTrackByCode(tenant.id, args.codeNormalized);
  if (existing) {
    return {
      ok: true,
      created: false,
      track: await weighExistingTrack(tenant.id, existing, pricing, args.createdBy),
    };
  }

  // Unknown code → create it unattached, already in CHINA_WAREHOUSE.
  const db = getDb();
  try {
    const [track] = await db
      .insert(tracks)
      .values({
        tenantId: tenant.id,
        codeNormalized: args.codeNormalized,
        codeOriginal: args.codeOriginal,
        currentStatus: 'CHINA_WAREHOUSE',
        ...pricing,
      })
      .returning();
    if (track) {
      await db.insert(trackEvents).values({
        trackId: track.id,
        status: 'CHINA_WAREHOUSE',
        meta: { source: 'bot-staff' },
        createdBy: args.createdBy,
      });
      return { ok: true, created: true, track };
    }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Lost a race: the code now exists — re-resolve and weigh it instead.
  }
  const raced = await findTrackByCode(tenant.id, args.codeNormalized);
  if (!raced) throw new Error('applyStaffWeighing: insert lost but code gone');
  return {
    ok: true,
    created: false,
    track: await weighExistingTrack(tenant.id, raced, pricing, args.createdBy),
  };
}

/** Write weight/price onto an existing track, advancing CREATED→CHINA_WAREHOUSE. */
async function weighExistingTrack(
  tenantId: string,
  track: Track,
  pricing: {
    weightGrams: number;
    tariffId: string | null;
    priceTiyin: number;
    priceUsdCents: number | null;
    usdRateUsed: number | null;
    priceManual: boolean;
  },
  createdBy: string,
): Promise<Track> {
  const db = getDb();
  const plan = planStaffWeighing({
    currentStatus: track.currentStatus,
    customerId: track.customerId,
  });

  const [updated] = await db
    .update(tracks)
    .set({ ...pricing, currentStatus: plan.newStatus })
    .where(and(eq(tracks.tenantId, tenantId), eq(tracks.id, track.id)))
    .returning();

  if (plan.willEvent) {
    await db.insert(trackEvents).values({
      trackId: track.id,
      status: plan.newStatus,
      meta: { source: 'bot-staff' },
      createdBy,
    });
  }
  if (plan.willNotify) {
    await enqueueNotification({
      tenantId,
      trackId: track.id,
      customerId: track.customerId!,
      status: plan.newStatus,
    });
  }
  return updated ?? track;
}
