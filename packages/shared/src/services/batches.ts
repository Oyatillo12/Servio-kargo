/**
 * Batch status propagation (SPEC §7.10).
 *
 * A batch ("Reys") status change applies that status to every member track that
 * is NOT terminal (DELIVERED/LOST/RETURNED) and NOT soft-deleted, reusing the
 * shared status-change planner so batch and panel/import flows never drift. Pure
 * + framework-free; the DB layer applies the returned writes/events/notifications.
 */

import { isTerminalStatus, type TrackStatus } from '../status';
import { planStatusChange } from './statusChange';

/** A batch's own status is limited to these three (§2, §7.10). */
export const BATCH_STATUSES = [
  'CHINA_WAREHOUSE',
  'IN_TRANSIT',
  'TASHKENT_WAREHOUSE',
] as const satisfies readonly TrackStatus[];

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export function isBatchStatus(status: TrackStatus): status is BatchStatus {
  return (BATCH_STATUSES as readonly TrackStatus[]).includes(status);
}

export interface BatchMemberTrack {
  id: string;
  currentStatus: TrackStatus;
  /** Attached customer id, or null when unclaimed. */
  customerId: string | null;
  /** Soft-delete timestamp, or null when live. */
  deletedAt: Date | null;
}

export interface BatchPropagationItem {
  trackId: string;
  customerId: string | null;
  /** Append a `track_events` row (always true here — only real changes list). */
  willEvent: boolean;
  /** Enqueue a §4.2 notification for the attached customer. */
  willNotify: boolean;
}

export interface BatchPropagationPlan {
  status: BatchStatus;
  /** Tracks whose status actually changes (get an event + maybe a notify). */
  updates: BatchPropagationItem[];
  /** Members left untouched: terminal, soft-deleted, or already at `status`. */
  skipped: number;
}

/**
 * Decide which member tracks a batch status change touches. Terminal and
 * soft-deleted members are skipped outright; the rest go through
 * {@link planStatusChange}, so a member already at `newStatus` is a no-op (§2).
 */
export function planBatchPropagation(
  newStatus: BatchStatus,
  members: BatchMemberTrack[],
): BatchPropagationPlan {
  const updates: BatchPropagationItem[] = [];
  let skipped = 0;

  for (const member of members) {
    if (member.deletedAt != null || isTerminalStatus(member.currentStatus)) {
      skipped += 1;
      continue;
    }
    const plan = planStatusChange({
      previousStatus: member.currentStatus,
      newStatus,
      customerId: member.customerId,
      wasDeleted: false,
    });
    if (!plan.willWrite) {
      skipped += 1; // already at this status → §2 no-op
      continue;
    }
    updates.push({
      trackId: member.id,
      customerId: member.customerId,
      willEvent: plan.willEvent,
      willNotify: plan.willNotify,
    });
  }

  return { status: newStatus, updates, skipped };
}
