/**
 * Mini App data access (tasks.md B). Deliberately NOT in the `lib/queries`
 * barrel: that surface is scoped by the ADMIN session; everything here is
 * scoped by the TWA customer session (tenant_id + customer_id from the
 * verified cookie), and nothing must leak between the two.
 */

import 'server-only';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  customers,
  payments,
  tariffs,
  tenants,
  trackEvents,
  trackPhotos,
  tracks,
  type Customer,
  type Payment,
  type TrackStatus,
} from '@kargotrack/db/schema';
import {
  computeDebtTiyin,
  isTerminalStatus,
  statusSortIndex,
  type TenantPlan,
} from '@kargotrack/shared';

export interface TwaTenant {
  id: string;
  name: string;
  plan: TenantPlan;
  /** Needed server-side to validate initData; NEVER sent to the client. */
  botToken: string;
  botUsername: string | null;
  currency: 'UZS' | 'USD';
  usdRateTiyin: number | null;
  /** `settings.china_address_template`, `{client_code}` placeholder inside. */
  chinaAddressTemplate: string | null;
  pickupAddress: string | null;
  workingHours: string | null;
  contactPhone: string | null;
  /** Free-text info the tenant shows customers (`settings.info_text`). */
  infoText: string | null;
}

export async function getTwaTenant(
  tenantId: string,
): Promise<TwaTenant | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      plan: tenants.plan,
      botToken: tenants.botToken,
      botUsername: tenants.botUsername,
      currency: tenants.currency,
      usdRateTiyin: tenants.usdRateTiyin,
      pickupAddress: tenants.pickupAddress,
      workingHours: tenants.workingHours,
      contactPhone: tenants.contactPhone,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!row) return null;
  const { settings, ...rest } = row;
  return {
    ...rest,
    chinaAddressTemplate: settings?.china_address_template ?? null,
    infoText: settings?.info_text ?? null,
  };
}

export interface TwaHomeSummary {
  /** Parcels still moving (pre-DELIVERED pipeline statuses). */
  activeCount: number;
  /** Of those, waiting at the pickup point right now. */
  readyCount: number;
  debtTiyin: number;
}

/** The three numbers the home screen leads with. */
export async function getTwaHomeSummary(
  tenantId: string,
  customerId: string,
): Promise<TwaHomeSummary> {
  const db = getDb();
  const [rows, { debtTiyin }] = await Promise.all([
    db
      .select({ currentStatus: tracks.currentStatus })
      .from(tracks)
      .where(
        and(
          eq(tracks.tenantId, tenantId),
          eq(tracks.customerId, customerId),
          isNull(tracks.deletedAt),
        ),
      ),
    getTwaFinance(tenantId, customerId),
  ]);

  let activeCount = 0;
  let readyCount = 0;
  for (const r of rows) {
    if (r.currentStatus === 'READY_FOR_PICKUP') readyCount += 1;
    if (!isTerminalStatus(r.currentStatus)) activeCount += 1;
  }
  return { activeCount, readyCount, debtTiyin };
}

export interface TwaTariff {
  id: string;
  name: string;
  pricePerKgMinor: number;
  isDefault: boolean;
}

/** Active tariffs, default first — the same order the bot's /calc shows. */
export async function listTwaTariffs(tenantId: string): Promise<TwaTariff[]> {
  const db = getDb();
  return db
    .select({
      id: tariffs.id,
      name: tariffs.name,
      pricePerKgMinor: tariffs.pricePerKgMinor,
      isDefault: tariffs.isDefault,
    })
    .from(tariffs)
    .where(and(eq(tariffs.tenantId, tenantId), eq(tariffs.active, true)))
    .orderBy(desc(tariffs.isDefault), asc(tariffs.sort), asc(tariffs.name));
}

export async function getTwaCustomerByTg(
  tenantId: string,
  tgUserId: number,
): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row ?? null;
}

export interface TwaTrackRow {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  weightGrams: number | null;
  priceTiyin: number | null;
  hasPhoto: boolean;
  createdAt: Date;
  /** Batch ETA, surfaced while the parcel is on the road (SPEC §4.2). */
  batchEta: string | null;
}

/** Practical ceiling — nobody scrolls further, and one query stays cheap. */
export const TWA_TRACKS_LIMIT = 300;

/** The customer's parcels, pipeline order (active first), newest inside. */
export async function listTwaTracks(
  tenantId: string,
  customerId: string,
): Promise<TwaTrackRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      hasPhoto: sql<boolean>`exists (select 1 from ${trackPhotos} where ${trackPhotos.trackId} = ${tracks.id})`,
      createdAt: tracks.createdAt,
      batchEta: batches.etaDate,
      batchStatus: batches.status,
    })
    .from(tracks)
    .leftJoin(batches, eq(tracks.batchId, batches.id))
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .orderBy(desc(tracks.createdAt))
    .limit(TWA_TRACKS_LIMIT);

  return rows
    .map((r) => ({
      id: r.id,
      codeOriginal: r.codeOriginal,
      currentStatus: r.currentStatus,
      weightGrams: r.weightGrams,
      priceTiyin: r.priceTiyin,
      hasPhoto: r.hasPhoto,
      createdAt: r.createdAt,
      // ETA only makes sense while the batch itself is still en route.
      batchEta:
        r.batchEta && r.batchStatus !== 'TASHKENT_WAREHOUSE'
          ? r.batchEta
          : null,
    }))
    .sort(
      (a, b) =>
        statusSortIndex(a.currentStatus) - statusSortIndex(b.currentStatus) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

export interface TwaTrackDetail {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  weightGrams: number | null;
  priceTiyin: number | null;
  /** Goods description (§7.13) — customer-visible; marka/note never are. */
  description: string | null;
  /** Photo ids, newest first (§7.14) — served one by one, ownership-gated. */
  photoIds: string[];
  createdAt: Date;
  batchEta: string | null;
  events: { status: TrackStatus; createdAt: Date }[];
}

/** One parcel — ONLY if it belongs to this customer (ownership is the gate). */
export async function getTwaTrackDetail(
  tenantId: string,
  customerId: string,
  trackId: string,
): Promise<TwaTrackDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      description: tracks.description,
      createdAt: tracks.createdAt,
      batchEta: batches.etaDate,
      batchStatus: batches.status,
    })
    .from(tracks)
    .leftJoin(batches, eq(tracks.batchId, batches.id))
    .where(
      and(
        eq(tracks.id, trackId),
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  const events = await db
    .select({ status: trackEvents.status, createdAt: trackEvents.createdAt })
    .from(trackEvents)
    .where(eq(trackEvents.trackId, row.id))
    .orderBy(asc(trackEvents.createdAt));

  // §7.14: all kinds — a damage photo is exactly what the customer must see.
  const photoRows = await db
    .select({ id: trackPhotos.id })
    .from(trackPhotos)
    .where(
      and(
        eq(trackPhotos.tenantId, tenantId),
        eq(trackPhotos.trackId, row.id),
      ),
    )
    .orderBy(desc(trackPhotos.createdAt));

  return {
    id: row.id,
    codeOriginal: row.codeOriginal,
    currentStatus: row.currentStatus,
    weightGrams: row.weightGrams,
    priceTiyin: row.priceTiyin,
    description: row.description,
    photoIds: photoRows.map((p) => p.id),
    createdAt: row.createdAt,
    batchEta:
      row.batchEta && row.batchStatus !== 'TASHKENT_WAREHOUSE'
        ? row.batchEta
        : null,
    events,
  };
}

/** ONE photo's path for the TWA route — same ownership gate as the detail. */
export async function getTwaTrackPhotoPath(
  tenantId: string,
  customerId: string,
  trackId: string,
  photoId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ path: trackPhotos.path })
    .from(trackPhotos)
    .innerJoin(tracks, eq(trackPhotos.trackId, tracks.id))
    .where(
      and(
        eq(trackPhotos.id, photoId),
        eq(trackPhotos.trackId, trackId),
        eq(trackPhotos.tenantId, tenantId),
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row?.path ?? null;
}

export interface TwaFinance {
  /** Positive = owes; negative = paid in advance (SPEC §7.5). */
  debtTiyin: number;
  payments: Pick<
    Payment,
    'id' | 'amountTiyin' | 'method' | 'note' | 'createdAt' | 'reversalOf'
  >[];
}

/** Balance + recent payments, computed by the ONE debt service (CLAUDE.md). */
export async function getTwaFinance(
  tenantId: string,
  customerId: string,
): Promise<TwaFinance> {
  const db = getDb();
  const [trackRows, paymentRows] = await Promise.all([
    db
      .select({
        currentStatus: tracks.currentStatus,
        priceTiyin: tracks.priceTiyin,
        deletedAt: tracks.deletedAt,
      })
      .from(tracks)
      .where(
        and(eq(tracks.tenantId, tenantId), eq(tracks.customerId, customerId)),
      ),
    db
      .select({
        id: payments.id,
        amountTiyin: payments.amountTiyin,
        method: payments.method,
        note: payments.note,
        createdAt: payments.createdAt,
        reversalOf: payments.reversalOf,
      })
      .from(payments)
      .where(
        and(
          eq(payments.tenantId, tenantId),
          eq(payments.customerId, customerId),
        ),
      )
      .orderBy(desc(payments.createdAt)),
  ]);

  return {
    debtTiyin: computeDebtTiyin(
      trackRows,
      paymentRows.map((p) => ({ amountTiyin: p.amountTiyin })),
    ),
    payments: paymentRows.slice(0, 20),
  };
}

export interface TwaPublicTrack {
  currentStatus: TrackStatus;
  /** When the status last changed — the only date the public view shows. */
  lastEventAt: Date;
}

/**
 * Public lookup (tasks.md B6): status + last-change date and NOTHING else —
 * no price, no owner, no weight. Anyone with the code can see where the
 * parcel is; everything money-shaped stays behind registration.
 */
export async function getTwaPublicTrack(
  tenantId: string,
  codeNormalized: string,
): Promise<TwaPublicTrack | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: tracks.id,
      currentStatus: tracks.currentStatus,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.codeNormalized, codeNormalized),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  const [lastEvent] = await db
    .select({ createdAt: trackEvents.createdAt })
    .from(trackEvents)
    .where(eq(trackEvents.trackId, row.id))
    .orderBy(desc(trackEvents.createdAt))
    .limit(1);

  return {
    currentStatus: row.currentStatus,
    lastEventAt: lastEvent?.createdAt ?? row.createdAt,
  };
}

export async function getTwaCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row ?? null;
}
