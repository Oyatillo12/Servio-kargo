/**
 * Track writes: status changes (SPEC §5.2 bulk / §5.3 single), customer
 * assignment (§5.3, §7.3) and soft delete.
 */

import 'server-only';

import { and, eq, inArray, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotifications } from '@kargotrack/db/queue';
import {
  customers,
  payments,
  trackEvents,
  tracks,
  type Payment,
} from '@kargotrack/db/schema';
import {
  BULK_CHUNK,
  chunked,
  isHandoverEligible,
  planAssignCustomer,
  planBulkStatusChange,
  type AssignEventMeta,
  type TrackStatus,
} from '@kargotrack/shared';

export interface StatusChangeResult {
  /** Tracks whose status genuinely changed (an event was appended). */
  changed: number;
  /** Notifications enqueued for attached customers (§4.2). */
  queued: number;
}

/**
 * Apply `status` to the given (tenant-scoped, non-deleted) tracks. Reuses the
 * shared `planBulkStatusChange` planner so the panel and import share one rule:
 * same-status writes are no-ops, real changes append a `track_events` row and
 * enqueue a §4.2 notification when a customer is attached. Backward moves are
 * allowed (mistake corrections, §7.2).
 *
 * Follows the `applyImport` shape (AUDIT.md T7): one transaction, ids grouped
 * into a bulk UPDATE + bulk event INSERT per chunk, notifications enqueued only
 * after the commit. A 500-track change costs a handful of round trips instead
 * of 1000+, and can no longer half-apply — leaving some tracks moved, some not,
 * and messages already sent about a state that was never written.
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

  // Enqueued only AFTER the transaction commits: pg-boss writes through its own
  // connection, so a job sent mid-transaction would survive a rollback and
  // notify about rows that were never written.
  let toNotify: { trackId: string; customerId: string }[] = [];

  await db.transaction(async (tx) => {
    const rows = await tx
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

    // Soft-deleted rows are filtered out above, so `willWrite` here means a real
    // status change — the planner's revive case belongs to the import path.
    const plan = planBulkStatusChange(args.status, rows);
    if (plan.writeIds.length === 0) return;

    // Every track in this call gets the same status, so the UPDATE groups into
    // one statement per chunk; the event rows differ only by track id.
    for (const chunk of chunked(plan.writeIds, BULK_CHUNK)) {
      await tx
        .update(tracks)
        .set({ currentStatus: args.status })
        .where(
          and(eq(tracks.tenantId, args.tenantId), inArray(tracks.id, chunk)),
        );
    }

    for (const chunk of chunked(plan.eventIds, BULK_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status: args.status,
          meta: { source: 'panel' },
          createdBy: args.createdBy,
        })),
      );
    }

    result.changed = plan.eventIds.length;
    toNotify = plan.notify;
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

// --- Handover counter (SPEC §5.15, tasks.md G, D-003) ------------------------

export interface HandoverResult {
  /** Tracks marked DELIVERED (events appended). */
  delivered: number;
  /** §4.2 notifications enqueued after the commit. */
  queued: number;
}

/**
 * The selection no longer matches reality — a parcel was delivered, deleted or
 * re-assigned since the screen loaded. Nothing was written; reload and retry.
 */
export type HandoverError = 'STALE_SELECTION';

/**
 * The counter action (SPEC §5.15 step 4): mark the selected parcels DELIVERED
 * and record the payment in ONE transaction — the whole point of the screen is
 * that "handed the box over" and "took the money" can never half-apply. Every
 * selected track is re-read inside the transaction and must still belong to
 * this tenant + customer and still be handover-eligible; any mismatch refuses
 * the whole action (STALE_SELECTION) rather than delivering a subset.
 *
 * Status effects go through the same shared planner as every other status
 * write; notifications are enqueued only after the commit (see
 * `setTrackStatuses` for why). `amountTiyin` 0 means "no payment" — handing
 * over to a customer in advance is an ordinary case, not an error.
 */
export async function handoverWithPayment(args: {
  tenantId: string;
  customerId: string;
  trackIds: string[];
  /** Whole payment in tiyin; 0 skips the payments insert. Never negative. */
  amountTiyin: number;
  method: Payment['method'];
  createdBy: string;
}): Promise<HandoverResult | HandoverError> {
  const db = getDb();
  const result: HandoverResult = { delivered: 0, queued: 0 };
  if (args.trackIds.length === 0) return 'STALE_SELECTION';

  let toNotify: { trackId: string; customerId: string }[] = [];
  let stale = false;

  await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: tracks.id,
        currentStatus: tracks.currentStatus,
        customerId: tracks.customerId,
        priceTiyin: tracks.priceTiyin,
        deletedAt: tracks.deletedAt,
      })
      .from(tracks)
      .where(
        and(
          eq(tracks.tenantId, args.tenantId),
          eq(tracks.customerId, args.customerId),
          inArray(tracks.id, args.trackIds),
          isNull(tracks.deletedAt),
        ),
      );

    const eligible = rows.filter((r) =>
      isHandoverEligible({
        currentStatus: r.currentStatus,
        priceTiyin: r.priceTiyin,
        deletedAt: r.deletedAt,
      }),
    );
    if (eligible.length !== args.trackIds.length) {
      stale = true;
      return; // nothing written — the empty transaction commits as a no-op
    }

    const plan = planBulkStatusChange('DELIVERED', eligible);

    for (const chunk of chunked(plan.writeIds, BULK_CHUNK)) {
      await tx
        .update(tracks)
        .set({ currentStatus: 'DELIVERED' })
        .where(
          and(eq(tracks.tenantId, args.tenantId), inArray(tracks.id, chunk)),
        );
    }
    for (const chunk of chunked(plan.eventIds, BULK_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status: 'DELIVERED' as TrackStatus,
          meta: { source: 'handover' },
          createdBy: args.createdBy,
        })),
      );
    }

    if (args.amountTiyin > 0) {
      await tx.insert(payments).values({
        tenantId: args.tenantId,
        customerId: args.customerId,
        amountTiyin: args.amountTiyin,
        method: args.method,
        note: null,
        createdBy: args.createdBy,
      });
    }

    result.delivered = plan.eventIds.length;
    toNotify = plan.notify;
  });

  if (stale) return 'STALE_SELECTION';

  await enqueueNotifications(
    toNotify.map((n) => ({
      tenantId: args.tenantId,
      trackId: n.trackId,
      customerId: n.customerId,
      status: 'DELIVERED' as TrackStatus,
    })),
  );
  result.queued = toNotify.length;
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
    for (const chunk of chunked(writes, BULK_CHUNK)) {
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

    for (const chunk of chunked(writes, BULK_CHUNK)) {
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

/**
 * Link a stored warehouse photo to a track (SPEC §3.8, §5.14). Tenant-scoped;
 * the path is relative to the uploads root and written by the caller, which is
 * what decides the filename — this only records it.
 *
 * Returns whether a row was actually updated, so an upload for a track that
 * belongs to another tenant (or has been deleted) fails loudly rather than
 * leaving an orphan file on disk claiming to be linked.
 */
export async function setTrackPhoto(args: {
  tenantId: string;
  trackId: string;
  photoPath: string;
}): Promise<boolean> {
  const rows = await getDb()
    .update(tracks)
    .set({ photoPath: args.photoPath })
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .returning({ id: tracks.id });
  return rows.length > 0;
}

/**
 * Unlink a track's warehouse photo (tasks.md A5 — the office-side fix-up).
 * Tenant-scoped. Returns the path that was stored, so the caller can remove the
 * file after the DB no longer points at it; null when there was nothing linked
 * (or the track isn't this tenant's), which callers treat as already done.
 */
export async function clearTrackPhoto(args: {
  tenantId: string;
  trackId: string;
}): Promise<string | null> {
  const db = getDb();
  // RETURNING hands back the post-update row (null), so read the path first.
  // A racing re-upload between the two statements loses its link and simply
  // re-takes the shot — the same stance the upload handler documents.
  const [row] = await db
    .select({ photoPath: tracks.photoPath })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  if (!row?.photoPath) return null;

  await db
    .update(tracks)
    .set({ photoPath: null })
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    );
  return row.photoPath;
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
