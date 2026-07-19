/**
 * Notification enqueue decisions + job shape (SPEC §4.2, §7.6, CLAUDE.md rule 3).
 *
 * Pure + framework-free: the DB/queue layer (`@kargotrack/db`) owns pg-boss and
 * imports these types/constants so producer (web) and consumer (bot) agree on
 * the payload and dedupe rule. No side effects here.
 */

import type { TrackStatus } from '../status';

/** pg-boss queue name for outbound customer notifications. */
export const NOTIFY_QUEUE = 'notify';

/** Job payload. Kept minimal — the worker re-reads track/customer/tenant fresh. */
export interface NotifyJob {
  tenantId: string;
  trackId: string;
  customerId: string;
  status: TrackStatus;
}

/**
 * Dedupe key for §7.6: used as the pg-boss `singletonKey` so a duplicate
 * in-flight job for the same track+status collapses into the pending one.
 */
export function notifyDedupeKey(trackId: string, status: TrackStatus): string {
  return `${trackId}:${status}`;
}

/** CREATED has no §4.2 template; every other status notifies. */
export function isNotifiableStatus(status: TrackStatus): boolean {
  return status !== 'CREATED';
}

export interface StatusChangeInput {
  /** Prior status, or `null` for a newly created track. */
  previousStatus: TrackStatus | null;
  newStatus: TrackStatus;
  /** Attached customer id, or `null` when the track is unclaimed. */
  customerId: string | null;
}

/**
 * Whether a status change should enqueue a customer notification.
 * Notify only when (SPEC §4.2 + §2):
 *  - a customer is attached (`customerId != null`),
 *  - the status actually changed (no-op writes never notify), and
 *  - the new status has a notification template (not CREATED).
 */
export function shouldEnqueueNotification(input: StatusChangeInput): boolean {
  if (input.customerId == null) return false;
  if (input.previousStatus === input.newStatus) return false;
  return isNotifiableStatus(input.newStatus);
}
