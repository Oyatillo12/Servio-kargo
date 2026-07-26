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
  tracks,
  type Batch,
  type Customer,
  type Track,
  type TrackEvent,
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
