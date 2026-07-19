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
