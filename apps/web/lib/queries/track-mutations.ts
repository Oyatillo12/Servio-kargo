/**
 * Track writes: status changes (SPEC §5.2 bulk / §5.3 single), customer
 * assignment (§5.3, §7.3) and soft delete.
 */

import 'server-only';

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification } from '@kargotrack/db/queue';
import { customers, trackEvents, tracks } from '@kargotrack/db/schema';
import {
  planAssignCustomer,
  planStatusChange,
  type AssignEventMeta,
  type TrackStatus,
} from '@kargotrack/shared';

import { chunked, IMPORT_CHUNK } from './internal';

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

// --- Track → customer assignment (SPEC §5.3, §7.3) --------------------------

export interface AssignCustomerResult {
  /** Tracks whose owner actually changed (an event was appended). */
  changed: number;
  /** Selected tracks that already had this owner — skipped as §2 no-ops. */
  skipped: number;
}

/** The target customer id was not found in this tenant. */
export type AssignCustomerError = 'NO_CUSTOMER';

/**
 * Attach the given (tenant-scoped, non-deleted) tracks to `customerId`, or
 * detach them when it is `null` (SPEC §5.3, §7.3). Ownership changes append a
 * `track_events` row carrying the track's *unchanged* status plus the
 * `planAssignCustomer` meta, so the audit log records who a parcel belonged to
 * and when that moved (CLAUDE.md rule 7).
 *
 * No notification is sent — see the rationale in `assignCustomer.ts`: this is
 * the day-0 bulk-attach path and §4.2 messages belong to status changes.
 *
 * Follows the `applyImport` shape: one transaction, ids grouped into a single
 * bulk UPDATE per chunk, so 500 tracks cost a handful of round trips instead of
 * 1000 and can never half-apply.
 */
export async function setTracksCustomer(args: {
  tenantId: string;
  trackIds: string[];
  customerId: string | null;
  createdBy: string;
}): Promise<AssignCustomerResult | AssignCustomerError> {
  const db = getDb();
  const result: AssignCustomerResult = { changed: 0, skipped: 0 };
  if (args.trackIds.length === 0) return result;

  // Never trust an id from the client: the target must be OUR tenant's customer
  // (CLAUDE.md rule 1) or we would happily hand a parcel to another company.
  if (args.customerId != null) {
    const [target] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, args.tenantId),
          eq(customers.id, args.customerId),
        ),
      )
      .limit(1);
    if (!target) return 'NO_CUSTOMER';
  }

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: tracks.id, customerId: tracks.customerId })
      .from(tracks)
      .where(
        and(
          eq(tracks.tenantId, args.tenantId),
          inArray(tracks.id, args.trackIds),
          isNull(tracks.deletedAt),
        ),
      );

    const writes: { id: string; meta: AssignEventMeta }[] = [];
    for (const row of rows) {
      const plan = planAssignCustomer({
        currentCustomerId: row.customerId,
        newCustomerId: args.customerId,
      });
      if (!plan.willWrite) {
        result.skipped += 1;
        continue;
      }
      writes.push({ id: row.id, meta: plan.eventMeta! });
    }
    if (writes.length === 0) return;

    // Every write in this call sets the same customer_id, so the UPDATE groups
    // into one statement per chunk; only the audit meta differs per row.
    for (const chunk of chunked(writes, IMPORT_CHUNK)) {
      await tx
        .update(tracks)
        .set({ customerId: args.customerId })
        .where(
          and(
            eq(tracks.tenantId, args.tenantId),
            inArray(
              tracks.id,
              chunk.map((w) => w.id),
            ),
          ),
        );
    }

    // The event's status column is NOT NULL, so re-read each row's current
    // status (unchanged by this operation) to stamp the audit row with it.
    const statusById = new Map(
      (
        await tx
          .select({ id: tracks.id, currentStatus: tracks.currentStatus })
          .from(tracks)
          .where(
            and(
              eq(tracks.tenantId, args.tenantId),
              inArray(
                tracks.id,
                writes.map((w) => w.id),
              ),
            ),
          )
      ).map((r) => [r.id, r.currentStatus]),
    );

    for (const chunk of chunked(writes, IMPORT_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((w) => ({
          trackId: w.id,
          status: statusById.get(w.id)!,
          meta: { source: 'panel', ...w.meta },
          createdBy: args.createdBy,
        })),
      );
    }
    result.changed += writes.length;
  });

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
