/** Track lookups and writes driven by the bot (SPEC §3.6, §3.8), plus batches. */

import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  trackEvents,
  trackPhotos,
  tracks,
  type Batch,
  type Track,
} from '@kargotrack/db/schema';

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

/**
 * Record a new `intake` photo for a track (SPEC §3.8, §7.14). The caller wrote
 * the file; the path here (relative to uploadsDir) only records where.
 */
export async function addTrackPhoto(args: {
  tenantId: string;
  trackId: string;
  photoId: string;
  path: string;
  createdBy: string | null;
}): Promise<void> {
  await getDb().insert(trackPhotos).values({
    id: args.photoId,
    tenantId: args.tenantId,
    trackId: args.trackId,
    kind: 'intake',
    path: args.path,
    createdBy: args.createdBy,
  });
}

/**
 * A track's stored photo paths, newest first, capped for one Telegram album
 * (SPEC §7.14 — the 📷 button sends up to 10 as a media group).
 */
export async function listTrackPhotoPaths(
  tenantId: string,
  trackId: string,
  limit = 10,
): Promise<string[]> {
  const rows = await getDb()
    .select({ path: trackPhotos.path })
    .from(trackPhotos)
    .where(
      and(
        eq(trackPhotos.tenantId, tenantId),
        eq(trackPhotos.trackId, trackId),
      ),
    )
    .orderBy(desc(trackPhotos.createdAt))
    .limit(limit);
  return rows.map((r) => r.path);
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
