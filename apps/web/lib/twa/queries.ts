/**
 * Mini App data access (tasks.md B). Deliberately NOT in the `lib/queries`
 * barrel: that surface is scoped by the ADMIN session; everything here is
 * scoped by the TWA customer session (tenant_id + customer_id from the
 * verified cookie), and nothing must leak between the two.
 */

import 'server-only';

import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  customers,
  tenants,
  trackEvents,
  tracks,
  type Customer,
  type TrackStatus,
} from '@kargotrack/db/schema';
import { statusSortIndex, type TenantPlan } from '@kargotrack/shared';

export interface TwaTenant {
  id: string;
  name: string;
  plan: TenantPlan;
  /** Needed server-side to validate initData; NEVER sent to the client. */
  botToken: string;
  botUsername: string | null;
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
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row ?? null;
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
      photoPath: tracks.photoPath,
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
      hasPhoto: r.photoPath != null,
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
  hasPhoto: boolean;
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
      photoPath: tracks.photoPath,
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

  return {
    id: row.id,
    codeOriginal: row.codeOriginal,
    currentStatus: row.currentStatus,
    weightGrams: row.weightGrams,
    priceTiyin: row.priceTiyin,
    hasPhoto: row.photoPath != null,
    createdAt: row.createdAt,
    batchEta:
      row.batchEta && row.batchStatus !== 'TASHKENT_WAREHOUSE'
        ? row.batchEta
        : null,
    events,
  };
}

/** Photo path for the TWA photo route — same ownership gate as the detail. */
export async function getTwaTrackPhotoPath(
  tenantId: string,
  customerId: string,
  trackId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ photoPath: tracks.photoPath })
    .from(tracks)
    .where(
      and(
        eq(tracks.id, trackId),
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row?.photoPath ?? null;
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
