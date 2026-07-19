/**
 * Tenant-scoped database access for the admin panel. EVERY query filters by the
 * caller-supplied `tenantId` (CLAUDE.md rule 1) — that id always comes from the
 * session (`requireAdmin`), never from user input.
 */

import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sum,
} from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  enqueueBroadcast,
  enqueueNotification,
  enqueueReminder,
} from '@kargotrack/db/queue';
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
  type Broadcast,
  type Currency,
  type Customer,
  type Payment,
  type Tariff,
  type TenantSettings,
  type Track,
  type TrackEvent,
  type Transport,
} from '@kargotrack/db/schema';
import {
  bucketDailyTushum,
  computeDebtTiyin,
  computeTrackPrice,
  lastNDays,
  normalizeCode,
  periodRange,
  planBatchPropagation,
  planCreateTariff,
  planDelete,
  planSetActive,
  planStatusChange,
  TUSHUM_CHART_DAYS,
  type BatchStatus,
  type DashboardPeriod,
  type DebtTrack,
  type ImportCode,
  type TrackStatus,
  type TushumPoint,
} from '@kargotrack/shared';

export const TRACKS_PAGE_SIZE = 20;

// --- Tracks list (SPEC §5.2) ------------------------------------------------

export interface TrackListRow {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  weightGrams: number | null;
  priceTiyin: number | null;
  createdAt: Date;
  customerId: string | null;
  customerName: string | null;
  clientCode: string | null;
  batchId: string | null;
  batchName: string | null;
}

export interface TrackListResult {
  rows: TrackListRow[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Search (code / customer name / phone) + status filter + pagination. The code
 * search normalizes the query the same way codes are stored (CLAUDE.md rule 4)
 * so `yt-7583` matches `YT7583…`.
 */
export async function listTracks(args: {
  tenantId: string;
  q?: string;
  status?: TrackStatus;
  batchId?: string;
  page: number;
}): Promise<TrackListResult> {
  const db = getDb();

  const conds = [eq(tracks.tenantId, args.tenantId), isNull(tracks.deletedAt)];
  if (args.status) conds.push(eq(tracks.currentStatus, args.status));
  if (args.batchId) conds.push(eq(tracks.batchId, args.batchId));

  const q = args.q?.trim();
  if (q) {
    const like = `%${q}%`;
    const norm = normalizeCode(q);
    const searchConds = [
      ilike(customers.fullName, like),
      ilike(customers.phone, like),
      ilike(customers.clientCode, like),
    ];
    searchConds.push(
      norm ? ilike(tracks.codeNormalized, `%${norm}%`) : ilike(tracks.codeOriginal, like),
    );
    conds.push(or(...searchConds)!);
  }
  const where = and(...conds);

  const [totalRow] = await db
    .select({ value: count() })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(where);
  const total = totalRow?.value ?? 0;

  const pages = Math.max(1, Math.ceil(total / TRACKS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(args.page)), pages);
  const offset = (page - 1) * TRACKS_PAGE_SIZE;

  const rows = await db
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      createdAt: tracks.createdAt,
      customerId: customers.id,
      customerName: customers.fullName,
      clientCode: customers.clientCode,
      batchId: batches.id,
      batchName: batches.name,
    })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .leftJoin(batches, eq(tracks.batchId, batches.id))
    .where(where)
    .orderBy(desc(tracks.createdAt))
    .limit(TRACKS_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pages };
}

// --- Track detail (SPEC §5.3) -----------------------------------------------

export interface TrackDetail {
  track: Track;
  customer: Customer | null;
  batch: Batch | null;
  events: TrackEvent[];
}

export async function getTrackDetail(
  tenantId: string,
  trackId: string,
): Promise<TrackDetail | null> {
  const db = getDb();

  const [track] = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.id, trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  if (!track) return null;

  let batch: Batch | null = null;
  if (track.batchId) {
    const [row] = await db
      .select()
      .from(batches)
      .where(and(eq(batches.tenantId, tenantId), eq(batches.id, track.batchId)))
      .limit(1);
    batch = row ?? null;
  }

  let customer: Customer | null = null;
  if (track.customerId) {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, track.customerId),
        ),
      )
      .limit(1);
    customer = row ?? null;
  }

  const events = await db
    .select()
    .from(trackEvents)
    .where(eq(trackEvents.trackId, track.id))
    .orderBy(desc(trackEvents.createdAt));

  return { track, customer, batch, events };
}

/** The stored photo path for a track (tenant-scoped), or `null`. */
export async function getTrackPhotoPath(
  tenantId: string,
  trackId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ photoPath: tracks.photoPath })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.id, trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row?.photoPath ?? null;
}

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

// --- Status change (SPEC §5.2 bulk / §5.3 single) ---------------------------

export interface StatusChangeResult {
  /** Tracks whose status genuinely changed (an event was appended). */
  changed: number;
  /** Notifications enqueued for attached customers (§4.2). */
  queued: number;
}

/**
 * Apply `status` to the given (tenant-scoped, non-deleted) tracks. Reuses the
 * shared `planStatusChange` planner so the panel and import share one rule:
 * same-status writes are no-ops, real changes append a `track_events` row and
 * enqueue a §4.2 notification when a customer is attached. Backward moves are
 * allowed (mistake corrections, §7.2).
 */
export async function setTrackStatuses(args: {
  tenantId: string;
  trackIds: string[];
  status: TrackStatus;
  createdBy: string;
}): Promise<StatusChangeResult> {
  const db = getDb();
  const result: StatusChangeResult = { changed: 0, queued: 0 };
  if (args.trackIds.length === 0) return result;

  const rows = await db
    .select({
      id: tracks.id,
      currentStatus: tracks.currentStatus,
      customerId: tracks.customerId,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        inArray(tracks.id, args.trackIds),
        isNull(tracks.deletedAt),
      ),
    );

  for (const row of rows) {
    const plan = planStatusChange({
      previousStatus: row.currentStatus,
      newStatus: args.status,
      customerId: row.customerId,
      wasDeleted: false,
    });
    if (!plan.willWrite) continue; // §2 no-op

    await db
      .update(tracks)
      .set({ currentStatus: args.status })
      .where(and(eq(tracks.tenantId, args.tenantId), eq(tracks.id, row.id)));

    if (plan.willEvent) {
      await db.insert(trackEvents).values({
        trackId: row.id,
        status: args.status,
        meta: { source: 'panel' },
        createdBy: args.createdBy,
      });
      result.changed += 1;
    }

    if (plan.willNotify) {
      await enqueueNotification({
        tenantId: args.tenantId,
        trackId: row.id,
        customerId: row.customerId!,
        status: args.status,
      });
      result.queued += 1;
    }
  }

  return result;
}

/** Soft-delete a track (SPEC §5.3 `O'chirish`). Tenant-scoped, idempotent. */
export async function softDeleteTrack(args: {
  tenantId: string;
  trackId: string;
}): Promise<void> {
  await getDb()
    .update(tracks)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    );
}

// --- Settings (SPEC §5.7) ---------------------------------------------------

/** Update a tenant's office info and settings jsonb. Tenant-scoped. */
export async function updateTenantSettings(args: {
  tenantId: string;
  pickupAddress: string | null;
  workingHours: string | null;
  contactPhone: string | null;
  settings: TenantSettings;
}): Promise<void> {
  await getDb()
    .update(tenants)
    .set({
      pickupAddress: args.pickupAddress,
      workingHours: args.workingHours,
      contactPhone: args.contactPhone,
      settings: args.settings,
    })
    .where(eq(tenants.id, args.tenantId));
}

/** Update a tenant's billing currency + USD rate (SPEC §5.9). Tenant-scoped. */
export async function updateTenantCurrency(args: {
  tenantId: string;
  currency: Currency;
  /** Som per 1 USD in tiyin; null when currency is UZS. */
  usdRateTiyin: number | null;
}): Promise<void> {
  await getDb()
    .update(tenants)
    .set({ currency: args.currency, usdRateTiyin: args.usdRateTiyin })
    .where(eq(tenants.id, args.tenantId));
}

// --- Tariffs (SPEC §5.9, §7.4) ----------------------------------------------

/** All tariffs for a tenant, default first then by sort/name. */
export async function listTariffs(tenantId: string): Promise<Tariff[]> {
  return getDb()
    .select()
    .from(tariffs)
    .where(eq(tariffs.tenantId, tenantId))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** Active tariffs only (for the bot info card + track/import selects). */
export async function listActiveTariffs(tenantId: string): Promise<Tariff[]> {
  return getDb()
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.active, true)))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

/** The tenant's active default tariff (SPEC §7.4), or null if none set yet. */
export async function getDefaultTariff(tenantId: string): Promise<Tariff | null> {
  const [row] = await getDb()
    .select()
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.isDefault, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Create a tariff, enforcing "exactly one active default" via the shared
 * planner (§5.9): the first tariff is forced active-default; a new default
 * demotes the previous one and is forced active.
 */
export async function createTariff(args: {
  tenantId: string;
  name: string;
  pricePerKgMinor: number;
  isDefault: boolean;
  active: boolean;
}): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, args.tenantId));
    const plan = planCreateTariff(existing, {
      isDefault: args.isDefault,
      active: args.active,
    });
    if (plan.unsetDefaultIds.length > 0) {
      await tx
        .update(tariffs)
        .set({ isDefault: false })
        .where(inArray(tariffs.id, plan.unsetDefaultIds));
    }
    await tx.insert(tariffs).values({
      tenantId: args.tenantId,
      name: args.name,
      pricePerKgMinor: args.pricePerKgMinor,
      isDefault: plan.isDefault,
      active: plan.active,
    });
  });
}

/** Rename / re-price a tariff. Tenant-scoped; does not touch default/active. */
export async function updateTariff(args: {
  tenantId: string;
  tariffId: string;
  name: string;
  pricePerKgMinor: number;
}): Promise<void> {
  await getDb()
    .update(tariffs)
    .set({ name: args.name, pricePerKgMinor: args.pricePerKgMinor })
    .where(
      and(eq(tariffs.tenantId, args.tenantId), eq(tariffs.id, args.tariffId)),
    );
}

/**
 * Promote a tariff to the tenant's default (§5.9): it becomes default + active,
 * all other defaults are cleared. Returns false if the tariff doesn't exist.
 */
export async function setDefaultTariff(
  tenantId: string,
  tariffId: string,
): Promise<boolean> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    if (!rows.some((r) => r.id === tariffId)) return false;
    await tx
      .update(tariffs)
      .set({ isDefault: false })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.isDefault, true)));
    await tx
      .update(tariffs)
      .set({ isDefault: true, active: true })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return true;
  });
}

/**
 * Toggle a tariff's active flag. Refuses to deactivate the default (§5.9).
 * Returns an error code string on refusal, or null on success.
 */
export async function setTariffActive(
  tenantId: string,
  tariffId: string,
  active: boolean,
): Promise<'NOT_FOUND' | 'DEFAULT_MUST_STAY_ACTIVE' | 'CANNOT_DELETE_DEFAULT' | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    const res = planSetActive(rows, tariffId, active);
    if (!res.ok) return res.error ?? 'NOT_FOUND';
    await tx
      .update(tariffs)
      .set({ active })
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return null;
  });
}

/** Delete a tariff. Refuses to delete the default (§5.9). */
export async function deleteTariff(
  tenantId: string,
  tariffId: string,
): Promise<'NOT_FOUND' | 'DEFAULT_MUST_STAY_ACTIVE' | 'CANNOT_DELETE_DEFAULT' | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tariffs.id, isDefault: tariffs.isDefault, active: tariffs.active })
      .from(tariffs)
      .where(eq(tariffs.tenantId, tenantId));
    const res = planDelete(rows, tariffId);
    if (!res.ok) return res.error ?? 'NOT_FOUND';
    await tx
      .delete(tariffs)
      .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.id, tariffId)));
    return null;
  });
}

// --- Customers list with debt (SPEC §5.5, debt per SPEC §7.5) ---------------

export interface CustomerRow {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
  trackCount: number;
  debtTiyin: number;
}

/**
 * Customers (optionally filtered) with their non-deleted track count and net
 * debt. Debt is computed via the shared `computeDebtTiyin` service (SPEC §7.5):
 * we pull the tenant's non-deleted tracks and payments once and group in memory
 * — fine at MVP scale and keeps the tested pure function as the single source
 * of the debt rule.
 */
export async function listCustomersWithDebt(
  tenantId: string,
  q?: string,
): Promise<CustomerRow[]> {
  const db = getDb();

  const conds = [eq(customers.tenantId, tenantId)];
  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    conds.push(
      or(
        ilike(customers.fullName, like),
        ilike(customers.phone, like),
        ilike(customers.clientCode, like),
      )!,
    );
  }
  const custs = await db
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(asc(customers.clientCode));

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
  const countByCustomer = new Map<string, number>();
  for (const t of trackRows) {
    if (!t.customerId) continue;
    const list = tracksByCustomer.get(t.customerId) ?? [];
    list.push({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    });
    tracksByCustomer.set(t.customerId, list);
    countByCustomer.set(t.customerId, (countByCustomer.get(t.customerId) ?? 0) + 1);
  }

  const paymentsByCustomer = new Map<string, { amountTiyin: number }[]>();
  for (const p of payRows) {
    const list = paymentsByCustomer.get(p.customerId) ?? [];
    list.push({ amountTiyin: p.amountTiyin });
    paymentsByCustomer.set(p.customerId, list);
  }

  return custs.map((c) => ({
    id: c.id,
    clientCode: c.clientCode,
    fullName: c.fullName,
    phone: c.phone,
    trackCount: countByCustomer.get(c.id) ?? 0,
    debtTiyin: computeDebtTiyin(
      tracksByCustomer.get(c.id) ?? [],
      paymentsByCustomer.get(c.id) ?? [],
    ),
  }));
}

// --- Customer detail + payments (SPEC §5.5) ---------------------------------

export interface CustomerDetail {
  customer: Customer;
  tracks: Track[];
  payments: Payment[];
  debtTiyin: number;
}

/**
 * A customer with their non-deleted tracks, payment history (newest first) and
 * net debt (SPEC §7.5, via the shared `computeDebtTiyin`). Tenant-scoped.
 */
export async function getCustomerDetail(
  tenantId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const db = getDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  if (!customer) return null;

  const custTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .orderBy(desc(tracks.createdAt));

  const custPayments = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));

  const debtTiyin = computeDebtTiyin(
    custTracks.map((t) => ({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    })),
    custPayments.map((p) => ({ amountTiyin: p.amountTiyin })),
  );

  return { customer, tracks: custTracks, payments: custPayments, debtTiyin };
}

/** Record a payment for a customer (amount in tiyin). Tenant-scoped (§5.5). */
export async function createPayment(args: {
  tenantId: string;
  customerId: string;
  amountTiyin: number;
  method: Payment['method'];
  note: string | null;
}): Promise<void> {
  await getDb().insert(payments).values({
    tenantId: args.tenantId,
    customerId: args.customerId,
    amountTiyin: args.amountTiyin,
    method: args.method,
    note: args.note,
  });
}

// --- Debtors (SPEC §5.6) ----------------------------------------------------

/** Customers with net debt > 0, sorted by debt descending (SPEC §5.6). */
export async function listDebtors(tenantId: string): Promise<CustomerRow[]> {
  const all = await listCustomersWithDebt(tenantId);
  return all
    .filter((c) => c.debtTiyin > 0)
    .sort((a, b) => b.debtTiyin - a.debtTiyin);
}

/**
 * Enqueue a manual debt reminder for a customer (SPEC §4.4). Fire-and-forget:
 * the bot's reminder worker re-checks the debt and sends, respecting rate
 * limits. Membership of the customer in this tenant is the caller's guarantee.
 */
export async function queueReminder(
  tenantId: string,
  customerId: string,
): Promise<void> {
  await enqueueReminder({ tenantId, customerId, reason: 'manual' });
}

// --- Broadcast / Xabarnoma (SPEC §5.8, §7.11) -------------------------------

/** Ids of a tenant's customers reachable on Telegram (broadcast recipients). */
export async function listCustomerIdsWithTelegram(
  tenantId: string,
): Promise<string[]> {
  const rows = await getDb()
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), isNotNull(customers.tgUserId)));
  return rows.map((r) => r.id);
}

/** Insert a broadcast record (sent_count starts at 0). Returns its id (§5.8). */
export async function createBroadcast(
  tenantId: string,
  text: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(broadcasts)
    .values({ tenantId, text })
    .returning({ id: broadcasts.id });
  return row!.id;
}

/**
 * Create a broadcast and fan it out to one throttled-queue job per reachable
 * customer (SPEC §7.11). Returns how many recipients were enqueued.
 */
export async function sendBroadcast(
  tenantId: string,
  text: string,
): Promise<number> {
  const recipientIds = await listCustomerIdsWithTelegram(tenantId);
  const broadcastId = await createBroadcast(tenantId, text);
  for (const customerId of recipientIds) {
    await enqueueBroadcast({ tenantId, broadcastId, customerId, text });
  }
  return recipientIds.length;
}

/** Past broadcasts, newest first (SPEC §5.8 history). Tenant-scoped. */
export async function listBroadcasts(tenantId: string): Promise<Broadcast[]> {
  return getDb()
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.tenantId, tenantId))
    .orderBy(desc(broadcasts.createdAt));
}

// --- Batches / Reyslar (SPEC §5.7, §7.10) -----------------------------------

export interface BatchListRow {
  id: string;
  name: string;
  transport: Transport;
  etaDate: string | null;
  status: TrackStatus;
  trackCount: number;
  createdAt: Date;
}

/** All batches for a tenant (newest first) with their member track counts. */
export async function listBatches(tenantId: string): Promise<BatchListRow[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(batches)
    .where(eq(batches.tenantId, tenantId))
    .orderBy(desc(batches.createdAt));

  // Non-deleted member counts, grouped in one query.
  const counts = await db
    .select({ batchId: tracks.batchId, n: count() })
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)))
    .groupBy(tracks.batchId);
  const countMap = new Map(counts.map((c) => [c.batchId, c.n]));

  return rows.map((b) => ({
    id: b.id,
    name: b.name,
    transport: b.transport,
    etaDate: b.etaDate,
    status: b.status,
    trackCount: countMap.get(b.id) ?? 0,
    createdAt: b.createdAt,
  }));
}

/** Create a batch (SPEC §5.7). `etaDate` is an ISO `YYYY-MM-DD` string or null. */
export async function createBatch(args: {
  tenantId: string;
  name: string;
  transport: Transport;
  etaDate: string | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(batches)
    .values({
      tenantId: args.tenantId,
      name: args.name,
      transport: args.transport,
      etaDate: args.etaDate,
    })
    .returning({ id: batches.id });
  return row!.id;
}

export interface BatchMemberRow {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  customerId: string | null;
  customerLabel: string | null;
}

export interface BatchDetail {
  batch: Batch;
  members: BatchMemberRow[];
}

/** A batch with its non-deleted member tracks (SPEC §5.7). Tenant-scoped. */
export async function getBatchDetail(
  tenantId: string,
  batchId: string,
): Promise<BatchDetail | null> {
  const db = getDb();

  const [batch] = await db
    .select()
    .from(batches)
    .where(and(eq(batches.tenantId, tenantId), eq(batches.id, batchId)))
    .limit(1);
  if (!batch) return null;

  const members = await db
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      customerId: tracks.customerId,
      clientCode: customers.clientCode,
      customerName: customers.fullName,
    })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.batchId, batchId),
        isNull(tracks.deletedAt),
      ),
    )
    .orderBy(desc(tracks.createdAt));

  return {
    batch,
    members: members.map((m) => ({
      id: m.id,
      codeOriginal: m.codeOriginal,
      currentStatus: m.currentStatus,
      customerId: m.customerId,
      customerLabel:
        m.clientCode || m.customerName
          ? `${m.clientCode ?? ''}${m.clientCode && m.customerName ? ' · ' : ''}${m.customerName ?? ''}`
          : null,
    })),
  };
}

/** Update a batch's ETA (SPEC §5.7). `etaDate` is ISO `YYYY-MM-DD` or null. */
export async function updateBatchEta(
  tenantId: string,
  batchId: string,
  etaDate: string | null,
): Promise<void> {
  await getDb()
    .update(batches)
    .set({ etaDate })
    .where(and(eq(batches.tenantId, tenantId), eq(batches.id, batchId)));
}

/**
 * Attach the given (tenant-scoped, non-deleted) tracks to a batch — or detach
 * (batchId null). Used by the tracks bulk bar and the import wizard (§5.2, §7.2).
 */
export async function assignTracksToBatch(args: {
  tenantId: string;
  trackIds: string[];
  batchId: string | null;
}): Promise<number> {
  if (args.trackIds.length === 0) return 0;
  const rows = await getDb()
    .update(tracks)
    .set({ batchId: args.batchId })
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        inArray(tracks.id, args.trackIds),
        isNull(tracks.deletedAt),
      ),
    )
    .returning({ id: tracks.id });
  return rows.length;
}

/**
 * Apply a batch status change (SPEC §7.10): set the batch's own status and
 * propagate to every non-terminal, non-deleted member track via the shared
 * `planBatchPropagation`, appending events + enqueuing §4.2 notifications —
 * exactly the machinery the panel/import bulk flows use.
 */
export async function changeBatchStatus(args: {
  tenantId: string;
  batchId: string;
  status: BatchStatus;
  createdBy: string;
}): Promise<StatusChangeResult | null> {
  const db = getDb();

  const [batch] = await db
    .select({ id: batches.id })
    .from(batches)
    .where(and(eq(batches.tenantId, args.tenantId), eq(batches.id, args.batchId)))
    .limit(1);
  if (!batch) return null;

  const members = await db
    .select({
      id: tracks.id,
      currentStatus: tracks.currentStatus,
      customerId: tracks.customerId,
      deletedAt: tracks.deletedAt,
    })
    .from(tracks)
    .where(and(eq(tracks.tenantId, args.tenantId), eq(tracks.batchId, args.batchId)));

  const plan = planBatchPropagation(args.status, members);
  const result: StatusChangeResult = { changed: 0, queued: 0 };

  for (const item of plan.updates) {
    await db
      .update(tracks)
      .set({ currentStatus: args.status })
      .where(and(eq(tracks.tenantId, args.tenantId), eq(tracks.id, item.trackId)));

    if (item.willEvent) {
      await db.insert(trackEvents).values({
        trackId: item.trackId,
        status: args.status,
        meta: { source: 'batch', batchId: args.batchId },
        createdBy: args.createdBy,
      });
      result.changed += 1;
    }
    if (item.willNotify) {
      await enqueueNotification({
        tenantId: args.tenantId,
        trackId: item.trackId,
        customerId: item.customerId!,
        status: args.status,
      });
      result.queued += 1;
    }
  }

  // The batch always records its own new status, even if no member changed.
  await db
    .update(batches)
    .set({ status: args.status })
    .where(and(eq(batches.tenantId, args.tenantId), eq(batches.id, args.batchId)));

  return result;
}

// --- Import (SPEC §5.4, §7.2) -----------------------------------------------

/**
 * Which of `normalizedCodes` already exist for this tenant. Includes
 * soft-deleted rows because the (tenant_id, code_normalized) unique index does
 * — so the preview split matches what upsert can actually do (§7.2).
 */
export async function getExistingNormalizedCodes(
  tenantId: string,
  normalizedCodes: string[],
): Promise<Set<string>> {
  if (normalizedCodes.length === 0) return new Set();
  const rows = await getDb()
    .select({ code: tracks.codeNormalized })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        inArray(tracks.codeNormalized, normalizedCodes),
      ),
    );
  return new Set(rows.map((r) => r.code));
}

export interface ImportResult {
  created: number;
  updated: number;
  queued: number;
}

/**
 * Apply an import: upsert each code to `status` and append audit events (§7.2).
 * Existing rows only change (+ event + notify) when the status actually differs
 * or the row was soft-deleted (revived); same-status rows are no-ops (§2).
 * Every status change on an attached, non-deleted track enqueues a notification
 * (§4.2). New (unclaimed) tracks never notify.
 */
/** Rows per bulk INSERT / ids per bulk UPDATE — stays far under the Postgres
 * 65535-bind-parameter cap even with every track column bound. */
const IMPORT_CHUNK = 1000;

function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function applyImport(
  tenantId: string,
  status: TrackStatus,
  codes: ImportCode[],
  createdBy: string,
  batchId: string | null = null,
): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, queued: 0 };
  if (codes.length === 0) return result;

  // Enqueued only AFTER the transaction commits: pg-boss writes through its own
  // connection, so a job sent mid-transaction would survive a rollback and
  // notify about rows that were never written.
  const toNotify: Array<{ trackId: string; customerId: string }> = [];

  // All writes in one transaction — an import either fully applies or not at all.
  await db.transaction(async (tx) => {
    // Preload existing rows for this batch in one query.
    const existingRows = await tx
      .select({
        id: tracks.id,
        codeNormalized: tracks.codeNormalized,
        currentStatus: tracks.currentStatus,
        customerId: tracks.customerId,
        deletedAt: tracks.deletedAt,
      })
      .from(tracks)
      .where(
        and(
          eq(tracks.tenantId, tenantId),
          inArray(
            tracks.codeNormalized,
            codes.map((c) => c.normalized),
          ),
        ),
      );
    const existingByCode = new Map(
      existingRows.map((r) => [r.codeNormalized, r]),
    );

    // New codes → bulk insert. ON CONFLICT DO NOTHING absorbs a concurrent
    // import racing on the same (tenant, code): the loser's row silently skips
    // (not created, not updated this run) instead of aborting the whole import.
    const newCodes = codes.filter((c) => !existingByCode.has(c.normalized));
    for (const chunk of chunked(newCodes, IMPORT_CHUNK)) {
      const inserted = await tx
        .insert(tracks)
        .values(
          chunk.map((code) => ({
            tenantId,
            codeNormalized: code.normalized,
            codeOriginal: code.original,
            currentStatus: status,
            batchId,
          })),
        )
        .onConflictDoNothing({
          target: [tracks.tenantId, tracks.codeNormalized],
        })
        .returning({ id: tracks.id });
      if (inserted.length > 0) {
        await tx.insert(trackEvents).values(
          inserted.map((t) => ({
            trackId: t.id,
            status,
            meta: { source: 'import' },
            createdBy,
          })),
        );
      }
      result.created += inserted.length;
      // new tracks are unclaimed → no notification
    }

    // Existing codes → plan each row, then group ids by identical SET so every
    // group is one bulk UPDATE instead of a per-row round trip.
    const writeIds: string[] = []; // status change and/or revive
    const batchOnlyIds: string[] = []; // §7.2 batch attach on a §2 no-op row
    const eventIds: string[] = [];

    for (const code of codes) {
      const existing = existingByCode.get(code.normalized);
      if (!existing) continue;

      const plan = planStatusChange({
        previousStatus: existing.currentStatus,
        newStatus: status,
        customerId: existing.customerId,
        wasDeleted: existing.deletedAt != null,
      });
      // §7.2: a selected batch attaches to ALL rows, even ones whose status is
      // a §2 no-op. Skip only when there is nothing at all to write.
      if (plan.willWrite) writeIds.push(existing.id);
      else if (batchId != null) batchOnlyIds.push(existing.id);
      else continue;

      // §2: only a real status change appends an event.
      if (plan.willEvent) eventIds.push(existing.id);
      result.updated += 1;

      if (plan.willNotify) {
        toNotify.push({ trackId: existing.id, customerId: existing.customerId! });
      }
    }

    const writeSet: Partial<typeof tracks.$inferInsert> = {
      currentStatus: status,
      deletedAt: null,
    };
    if (batchId != null) writeSet.batchId = batchId;
    for (const chunk of chunked(writeIds, IMPORT_CHUNK)) {
      await tx.update(tracks).set(writeSet).where(inArray(tracks.id, chunk));
    }
    for (const chunk of chunked(batchOnlyIds, IMPORT_CHUNK)) {
      await tx.update(tracks).set({ batchId }).where(inArray(tracks.id, chunk));
    }
    for (const chunk of chunked(eventIds, IMPORT_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status,
          meta: { source: 'import' },
          createdBy,
        })),
      );
    }
  });

  for (const n of toNotify) {
    await enqueueNotification({
      tenantId,
      trackId: n.trackId,
      customerId: n.customerId,
      status,
    });
    result.queued += 1;
  }

  return result;
}

// --- Owner dashboard (SPEC §5.10) -------------------------------------------

export interface DashboardStats {
  /** CHINA_WAREHOUSE events in the period. */
  chinaReceived: number;
  /** TASHKENT_WAREHOUSE events in the period. */
  tashkentArrived: number;
  /** DELIVERED events in the period, with the summed weight/price of the tracks. */
  delivered: { count: number; weightGrams: number; priceTiyin: number };
  /** Payments received in the period (tiyin). */
  tushumTiyin: number;
  /** Customers who registered in the period. */
  newCustomers: number;
  /** Current net debt across all debtors (tiyin) — NOT period-based. */
  debtTiyin: number;
  /** Current number of customers with net debt > 0 — NOT period-based. */
  debtorCount: number;
}

/**
 * The six §5.10 stat cards for `period`, via single tenant-scoped aggregate
 * queries (no N+1). Period windows are Asia/Tashkent calendar days resolved by
 * the tested `periodRange` (§7.9). Event-count and delivered cards join
 * `track_events → tracks` (events carry no tenant_id) and exclude soft-deleted
 * tracks (§7.8). Debt is current, not period-scoped, and reuses `listDebtors`
 * (the tested `computeDebtTiyin` service).
 */
export async function getDashboardStats(
  tenantId: string,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<DashboardStats> {
  const db = getDb();
  const { startUtc, endUtc } = periodRange(now, period);

  const eventCount = async (status: TrackStatus): Promise<number> => {
    const [row] = await db
      .select({ value: count() })
      .from(trackEvents)
      .innerJoin(tracks, eq(trackEvents.trackId, tracks.id))
      .where(
        and(
          eq(tracks.tenantId, tenantId),
          isNull(tracks.deletedAt),
          eq(trackEvents.status, status),
          gte(trackEvents.createdAt, startUtc),
          lt(trackEvents.createdAt, endUtc),
        ),
      );
    return row?.value ?? 0;
  };

  const [chinaReceived, tashkentArrived, deliveredRow, tushumRow, custRow, debtors] =
    await Promise.all([
      eventCount('CHINA_WAREHOUSE'),
      eventCount('TASHKENT_WAREHOUSE'),
      db
        .select({
          count: count(),
          weightGrams: sum(tracks.weightGrams),
          priceTiyin: sum(tracks.priceTiyin),
        })
        .from(trackEvents)
        .innerJoin(tracks, eq(trackEvents.trackId, tracks.id))
        .where(
          and(
            eq(tracks.tenantId, tenantId),
            isNull(tracks.deletedAt),
            eq(trackEvents.status, 'DELIVERED'),
            gte(trackEvents.createdAt, startUtc),
            lt(trackEvents.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ value: sum(payments.amountTiyin) })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            gte(payments.createdAt, startUtc),
            lt(payments.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ value: count() })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            gte(customers.createdAt, startUtc),
            lt(customers.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      listDebtors(tenantId),
    ]);

  return {
    chinaReceived,
    tashkentArrived,
    delivered: {
      count: deliveredRow?.count ?? 0,
      weightGrams: Number(deliveredRow?.weightGrams ?? 0),
      priceTiyin: Number(deliveredRow?.priceTiyin ?? 0),
    },
    tushumTiyin: Number(tushumRow?.value ?? 0),
    newCustomers: custRow?.value ?? 0,
    debtTiyin: debtors.reduce((s, c) => s + c.debtTiyin, 0),
    debtorCount: debtors.length,
  };
}

/**
 * Daily tushum for the last 14 Tashkent days (§5.10 chart). One tenant-scoped
 * payments query over the whole window; buckets are assigned by the tested
 * `bucketDailyTushum`. Returns 14 points, oldest first, zero-filled.
 */
export async function getDailyTushum(
  tenantId: string,
  now: Date = new Date(),
): Promise<TushumPoint[]> {
  const buckets = lastNDays(now, TUSHUM_CHART_DAYS);
  const windowStart = buckets[0]!.startUtc;
  const windowEnd = buckets[buckets.length - 1]!.endUtc;

  const rows = await getDb()
    .select({ amountTiyin: payments.amountTiyin, createdAt: payments.createdAt })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        gte(payments.createdAt, windowStart),
        lt(payments.createdAt, windowEnd),
      ),
    );

  return bucketDailyTushum(buckets, rows);
}
