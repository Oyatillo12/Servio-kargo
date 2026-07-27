/**
 * Batches / Reyslar (SPEC §5.7, §7.10), including status propagation to member
 * tracks.
 */

import 'server-only';

import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotifications } from '@kargotrack/db/queue';
import {
  batches,
  customers,
  trackEvents,
  tracks,
  type Batch,
  type Transport,
} from '@kargotrack/db/schema';
import {
  BULK_CHUNK,
  chunked,
  planBatchPropagation,
  type BatchStatus,
  type TrackStatus,
} from '@kargotrack/shared';

import type { StatusChangeResult } from './track-mutations';

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
 *
 * All of it in one transaction, chunked (AUDIT.md T7). A flight carries far more
 * tracks than a screenful of checkboxes, so this is the worst of the per-row
 * loops: 2 500 members meant 5 000 round trips, and a connection dropped halfway
 * left the flight's own status disagreeing with its members' while the customers
 * of the first half had already been messaged.
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

  const result: StatusChangeResult = { changed: 0, queued: 0 };
  // Enqueued only AFTER the transaction commits — see `applyImport`.
  let toNotify: { trackId: string; customerId: string }[] = [];

  await db.transaction(async (tx) => {
    const members = await tx
      .select({
        id: tracks.id,
        currentStatus: tracks.currentStatus,
        customerId: tracks.customerId,
        deletedAt: tracks.deletedAt,
      })
      .from(tracks)
      .where(
        and(eq(tracks.tenantId, args.tenantId), eq(tracks.batchId, args.batchId)),
      );

    const plan = planBatchPropagation(args.status, members);

    // Every member in `updates` moves to the same status, so the UPDATE groups
    // into one statement per chunk; the event rows differ only by track id.
    const writeIds = plan.updates.map((u) => u.trackId);
    for (const chunk of chunked(writeIds, BULK_CHUNK)) {
      await tx
        .update(tracks)
        .set({ currentStatus: args.status })
        .where(
          and(eq(tracks.tenantId, args.tenantId), inArray(tracks.id, chunk)),
        );
    }

    const eventIds = plan.updates.filter((u) => u.willEvent).map((u) => u.trackId);
    for (const chunk of chunked(eventIds, BULK_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status: args.status,
          meta: { source: 'batch', batchId: args.batchId },
          createdBy: args.createdBy,
        })),
      );
    }

    // The batch always records its own new status, even if no member changed —
    // and now it commits together with the members it just moved.
    await tx
      .update(batches)
      .set({ status: args.status })
      .where(
        and(eq(batches.tenantId, args.tenantId), eq(batches.id, args.batchId)),
      );

    result.changed = eventIds.length;
    toNotify = plan.updates
      .filter((u) => u.willNotify)
      .map((u) => ({ trackId: u.trackId, customerId: u.customerId! }));
  });

  await enqueueNotifications(
    toNotify.map((n) => ({
      tenantId: args.tenantId,
      trackId: n.trackId,
      customerId: n.customerId,
      status: args.status,
    })),
  );
  result.queued = toNotify.length;

  return result;
}
