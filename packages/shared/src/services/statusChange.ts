/**
 * Status-transition planner (SPEC §2, §4.2, §7.2).
 *
 * Single source of truth for what a status write to an *existing* track should
 * do: whether to touch the row, whether to append a `track_events` audit row,
 * and whether to enqueue a customer notification. Used by both the bulk import
 * (`applyImport`) and the panel status-change flows so the two never drift.
 *
 * Pure + framework-free.
 */

import type { TrackStatus } from '../status';
import { shouldEnqueueNotification } from './notify';

export interface StatusTransitionInput {
  /** The track's current status before the write. */
  previousStatus: TrackStatus;
  /** The status the admin/import is applying. */
  newStatus: TrackStatus;
  /** Attached customer id, or `null` when the track is unclaimed. */
  customerId: string | null;
  /** Whether the row is currently soft-deleted (an import can revive it). */
  wasDeleted: boolean;
}

export interface StatusTransitionPlan {
  /** Update the row (status changed and/or a soft-deleted row is revived). */
  willWrite: boolean;
  /** Append a `track_events` row — only on a genuine status change (§2). */
  willEvent: boolean;
  /** Enqueue a §4.2 notification for the attached customer. */
  willNotify: boolean;
}

/**
 * Decide the effects of applying `newStatus` to an existing track.
 *  - Same status on a live row → no-op (no write, no event, no notify) per §2.
 *  - A real status change → write + event, and notify when the change is
 *    notifiable and a customer is attached (`shouldEnqueueNotification`).
 *  - A soft-deleted row is revived (write) even if the status is unchanged, but
 *    that revival alone appends no event and sends no notification.
 */
export function planStatusChange(
  input: StatusTransitionInput,
): StatusTransitionPlan {
  const statusChanged = input.previousStatus !== input.newStatus;
  return {
    willWrite: statusChanged || input.wasDeleted,
    willEvent: statusChanged,
    willNotify: shouldEnqueueNotification({
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      customerId: input.customerId,
    }),
  };
}

/** A track row as read by a bulk status change, before anything is written. */
export interface BulkStatusRow {
  id: string;
  currentStatus: TrackStatus;
  /** Attached customer id, or null when unclaimed. */
  customerId: string | null;
  /** Soft-delete timestamp; omitted when the caller already filtered them out. */
  deletedAt?: Date | null;
}

/** A notification to enqueue once the transaction has committed (§4.2). */
export interface BulkStatusNotify {
  trackId: string;
  customerId: string;
}

export interface BulkStatusPlan {
  /** Ids whose row must be updated — one bulk UPDATE, identical SET. */
  writeIds: string[];
  /** Ids that get a `track_events` row (a genuine status change, §2). */
  eventIds: string[];
  /** Notifications, enqueued only after the write commits. */
  notify: BulkStatusNotify[];
  /** Rows left untouched: already at `newStatus` (§2 no-op). */
  skipped: number;
}

/**
 * Group a whole selection of tracks into the three id lists a bulk status
 * change needs (AUDIT.md T7). Every row in a bulk change gets the *same* SET,
 * so the DB layer can issue one UPDATE and one INSERT per chunk instead of a
 * statement pair per track — and, because the plan is computed up front, the
 * notifications are known before the transaction opens and can be enqueued
 * after it commits rather than interleaved with the writes.
 *
 * Rules come from {@link planStatusChange}, so bulk, single and import flows
 * stay identical. A soft-deleted row is revived (write) without an event or a
 * notification, matching the import path.
 */
export function planBulkStatusChange(
  newStatus: TrackStatus,
  rows: readonly BulkStatusRow[],
): BulkStatusPlan {
  const plan: BulkStatusPlan = {
    writeIds: [],
    eventIds: [],
    notify: [],
    skipped: 0,
  };

  for (const row of rows) {
    const step = planStatusChange({
      previousStatus: row.currentStatus,
      newStatus,
      customerId: row.customerId,
      wasDeleted: row.deletedAt != null,
    });
    if (!step.willWrite) {
      plan.skipped += 1;
      continue;
    }
    plan.writeIds.push(row.id);
    if (step.willEvent) plan.eventIds.push(row.id);
    if (step.willNotify) {
      plan.notify.push({ trackId: row.id, customerId: row.customerId! });
    }
  }

  return plan;
}
