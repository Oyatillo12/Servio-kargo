/**
 * Tracks list + track detail (SPEC §5.2, §5.3). Read paths only — writes live
 * in `./track-mutations` and `./track-pricing`.
 */

import 'server-only';

import { and, count, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  customers,
  trackEvents,
  trackPhotos,
  tracks,
  type Batch,
  type Customer,
  type Track,
  type TrackEvent,
  type TrackPhoto,
} from '@kargotrack/db/schema';
import type { TrackStatus } from '@kargotrack/shared';

import { tracksFilter, type TrackFilter } from './track-filter';

export const TRACKS_PAGE_SIZE = 20;

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
export async function listTracks(args: TrackFilter & { page: number }): Promise<TrackListResult> {
  const db = getDb();

  const where = tracksFilter(args);

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

export interface TrackDetail {
  track: Track;
  customer: Customer | null;
  batch: Batch | null;
  events: TrackEvent[];
  /** The parcel's photos, newest first (SPEC §7.14). */
  photos: TrackPhotoListRow[];
}

/** One gallery row — the file itself is served by id, never by path. */
export interface TrackPhotoListRow {
  id: string;
  kind: TrackPhoto['kind'];
  createdAt: Date;
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

  const photos = await listTrackPhotos(tenantId, trackId);

  return { track, customer, batch, events, photos };
}

/** A track's photos, newest first (SPEC §7.14). Tenant-scoped. */
export async function listTrackPhotos(
  tenantId: string,
  trackId: string,
): Promise<TrackPhotoListRow[]> {
  return getDb()
    .select({
      id: trackPhotos.id,
      kind: trackPhotos.kind,
      createdAt: trackPhotos.createdAt,
    })
    .from(trackPhotos)
    .where(
      and(
        eq(trackPhotos.tenantId, tenantId),
        eq(trackPhotos.trackId, trackId),
      ),
    )
    .orderBy(desc(trackPhotos.createdAt));
}

/** The stored path of ONE photo of this tenant's track, or `null` (§7.14). */
export async function getTrackPhotoPath(
  tenantId: string,
  trackId: string,
  photoId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ path: trackPhotos.path })
    .from(trackPhotos)
    .where(
      and(
        eq(trackPhotos.tenantId, tenantId),
        eq(trackPhotos.trackId, trackId),
        eq(trackPhotos.id, photoId),
      ),
    )
    .limit(1);
  return row?.path ?? null;
}
