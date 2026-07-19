/**
 * Tenant-scoped database access for the bot. Every query is filtered by
 * `tenant_id` (CLAUDE.md rule 1). Handlers call these helpers and delegate all
 * decisions/formatting to `@kargotrack/shared`, so they stay thin.
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  broadcasts,
  customers,
  payments,
  tariffs,
  tenants,
  trackEvents,
  tracks,
  type Batch,
  type Customer,
  type Payment,
  type Tariff,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';
import { enqueueNotification } from '@kargotrack/db/queue';
import {
  type Lang,
  computeDebtTiyin,
  computeTrackPrice,
  nextClientCode,
  planStaffWeighing,
  type DebtTrack,
} from '@kargotrack/shared';

import { logger } from './logger';

/** Postgres unique-violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = '23505';
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return row;
}

export async function getTenantByToken(
  token: string,
): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.botToken, token))
    .limit(1);
  return row;
}

export async function listTenants(): Promise<Tenant[]> {
  return getDb().select().from(tenants);
}

export async function getCustomerByTg(
  tenantId: string,
  tgUserId: number,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row;
}

/**
 * Register (or return the existing) customer for a Telegram user. Assigns
 * `client_code = prefix + '-' + sequence` and retries on the unique-index
 * collision that a concurrent registration could cause.
 */
export async function registerCustomer(args: {
  tenant: Tenant;
  tgUserId: number;
  phone: string;
  fullName: string;
  lang: Lang;
}): Promise<Customer> {
  const db = getDb();
  const { tenant, tgUserId, phone, fullName, lang } = args;

  // A concurrent contact may have already created this customer.
  const existing = await getCustomerByTg(tenant.id, tgUserId);
  if (existing) {
    const [updated] = await db
      .update(customers)
      .set({ phone, fullName, lang })
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codeRows = await db
      .select({ clientCode: customers.clientCode })
      .from(customers)
      .where(eq(customers.tenantId, tenant.id));
    const clientCode = nextClientCode(
      tenant.codePrefix,
      codeRows.map((r) => r.clientCode),
    );

    try {
      const [row] = await db
        .insert(customers)
        .values({
          tenantId: tenant.id,
          tgUserId,
          phone,
          fullName,
          clientCode,
          lang,
        })
        .returning();
      if (row) return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Could be a client_code race (retry) or a tg_user race (return theirs).
      const raced = await getCustomerByTg(tenant.id, tgUserId);
      if (raced) return raced;
      logger.warn(
        { attempt, tenantId: tenant.id },
        'client_code collision, retrying',
      );
    }
  }
  throw new Error('registerCustomer: exhausted client_code retries');
}

export async function setCustomerLang(
  customerId: string,
  lang: Lang,
): Promise<void> {
  await getDb()
    .update(customers)
    .set({ lang })
    .where(eq(customers.id, customerId));
}

/** Non-deleted tracks for a customer (tenant-scoped). */
export async function listCustomerTracks(
  tenantId: string,
  customerId: string,
): Promise<Track[]> {
  const db = getDb();
  return db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    );
}

export async function listCustomerPayments(
  tenantId: string,
  customerId: string,
): Promise<Payment[]> {
  const db = getDb();
  return db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));
}

/**
 * Ids of a tenant's customers whose net debt is > 0 (SPEC §7.5), for the weekly
 * reminder sweep (§7.7). Pulls the tenant's non-deleted tracks + all payments
 * once and groups in memory through the shared `computeDebtTiyin` — the single
 * source of the debt rule, matching the admin panel's `listCustomersWithDebt`.
 */
export async function listTenantDebtorIds(tenantId: string): Promise<string[]> {
  const db = getDb();

  const trackRows = await db
    .select({
      customerId: tracks.customerId,
      currentStatus: tracks.currentStatus,
      priceTiyin: tracks.priceTiyin,
      deletedAt: tracks.deletedAt,
    })
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));

  const payRows = await db
    .select({
      customerId: payments.customerId,
      amountTiyin: payments.amountTiyin,
    })
    .from(payments)
    .where(eq(payments.tenantId, tenantId));

  const tracksByCustomer = new Map<string, DebtTrack[]>();
  for (const t of trackRows) {
    if (!t.customerId) continue;
    const list = tracksByCustomer.get(t.customerId) ?? [];
    list.push({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    });
    tracksByCustomer.set(t.customerId, list);
  }

  const paymentsByCustomer = new Map<string, { amountTiyin: number }[]>();
  for (const p of payRows) {
    const list = paymentsByCustomer.get(p.customerId) ?? [];
    list.push({ amountTiyin: p.amountTiyin });
    paymentsByCustomer.set(p.customerId, list);
  }

  const debtorIds: string[] = [];
  for (const [customerId, custTracks] of tracksByCustomer) {
    const debt = computeDebtTiyin(
      custTracks,
      paymentsByCustomer.get(customerId) ?? [],
    );
    if (debt > 0) debtorIds.push(customerId);
  }
  return debtorIds;
}

/** A single track by id (tenant-scoped), including soft-deleted rows. */
export async function getTrackById(
  tenantId: string,
  trackId: string,
): Promise<Track | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), eq(tracks.id, trackId)))
    .limit(1);
  return row;
}

/** A single customer by id (tenant-scoped). */
export async function getCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row;
}

/** Find a (non-deleted) track by normalized code within a tenant. */
export async function findTrackByCode(
  tenantId: string,
  codeNormalized: string,
): Promise<Track | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.codeNormalized, codeNormalized),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

/** Create a new CREATED track attached to a customer, plus its audit event. */
export async function createTrackForCustomer(args: {
  tenantId: string;
  customerId: string;
  codeNormalized: string;
  codeOriginal: string;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  const [track] = await db
    .insert(tracks)
    .values({
      tenantId: args.tenantId,
      customerId: args.customerId,
      codeNormalized: args.codeNormalized,
      codeOriginal: args.codeOriginal,
      currentStatus: 'CREATED',
    })
    .returning();
  if (!track) return;
  await db.insert(trackEvents).values({
    trackId: track.id,
    status: 'CREATED',
    meta: { source: 'bot' },
    createdBy: args.createdBy,
  });
}

/**
 * Attach an unclaimed track to a customer. Guarded by `customer_id IS NULL` so a
 * concurrent claim can't steal it; returns whether the claim succeeded.
 */
export async function claimTrack(
  trackId: string,
  customerId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(tracks)
    .set({ customerId })
    .where(and(eq(tracks.id, trackId), isNull(tracks.customerId)))
    .returning({ id: tracks.id });
  return rows.length > 0;
}

/** Link a warehouse photo (path relative to uploadsDir) to a track (SPEC §3.8). */
export async function setTrackPhoto(
  tenantId: string,
  trackId: string,
  photoPath: string,
): Promise<void> {
  await getDb()
    .update(tracks)
    .set({ photoPath })
    .where(and(eq(tracks.tenantId, tenantId), eq(tracks.id, trackId)));
}

/** Active tariffs for a tenant, default first (SPEC §3.5 info card). */
export async function getActiveTariffs(tenantId: string): Promise<Tariff[]> {
  const db = getDb();
  return db
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.active, true)))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** The tenant's single active default tariff (CLAUDE.md: always exactly one). */
export async function getDefaultTariff(
  tenantId: string,
): Promise<Tariff | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tariffs)
    .where(
      and(
        eq(tariffs.tenantId, tenantId),
        eq(tariffs.isDefault, true),
        eq(tariffs.active, true),
      ),
    )
    .limit(1);
  return row;
}

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

/** Bump a broadcast's delivered count by one (SPEC §5.8 / §7.11). Tenant-scoped. */
export async function incrementBroadcastSent(
  tenantId: string,
  broadcastId: string,
): Promise<void> {
  await getDb()
    .update(broadcasts)
    .set({ sentCount: sql`${broadcasts.sentCount} + 1` })
    .where(
      and(eq(broadcasts.tenantId, tenantId), eq(broadcasts.id, broadcastId)),
    );
}

/** A batch by id (tenant-scoped) — for the §3.6 ETA line + §4.2 notification. */
export async function getBatchById(
  tenantId: string,
  batchId: string,
): Promise<Batch | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.tenantId, tenantId), eq(batches.id, batchId)))
    .limit(1);
  return row;
}

/** Timestamp of the most recent audit event for a track (SPEC §3.6). */
export async function getLastEventAt(trackId: string): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ createdAt: trackEvents.createdAt })
    .from(trackEvents)
    .where(eq(trackEvents.trackId, trackId))
    .orderBy(desc(trackEvents.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}
