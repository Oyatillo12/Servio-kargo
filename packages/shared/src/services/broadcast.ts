/**
 * Broadcast queue contract (SPEC §5.8, §7.11, CLAUDE.md rule 3).
 *
 * Pure + framework-free (like `notify.ts` / `reminder.ts`): the DB/queue layer
 * (`@kargotrack/db`) owns pg-boss and imports these so producer (web) and
 * consumer (bot) agree on the payload. A broadcast fans out to one job per
 * recipient, each sent through the same throttled queue; the bot worker bumps
 * `broadcasts.sent_count` on every successful delivery so it records the final
 * count (§7.11).
 */

/** pg-boss queue for per-customer broadcast messages. */
export const BROADCAST_QUEUE = 'broadcast';

/** Max broadcast length the admin panel accepts (SPEC §5.8 textarea limit). */
export const BROADCAST_MAX_CHARS = 3500;

/**
 * How long a confirmed broadcast sits in the queue before the first message
 * leaves (SPEC §5.8, §7.11 — D-008). Inside this window cancelling reaches
 * everybody, because nobody has been reached yet. It is deliberately long
 * enough to re-read what you just sent to three thousand people.
 */
export const BROADCAST_HOLD_SECONDS = 60;

/** Lifecycle of a `broadcasts` row. `cancelled` stops the fan-out (§7.11). */
export type BroadcastStatus = 'queued' | 'cancelled';

/** One delivery of a real broadcast to one customer. */
export interface BroadcastFanoutJob {
  tenantId: string;
  /** The `broadcasts` row this delivery counts toward. */
  broadcastId: string;
  customerId: string;
  /** The admin's text, sent as-is — no wrapper (§4.5). */
  text: string;
  testChatId?: undefined;
}

/**
 * "Send me a test" (§5.8, tasks.md K1): the same text to the employee's own
 * chat. It carries a chat id instead of a customer because a staff member is
 * not one — and it counts toward nothing: no `broadcasts` row, no
 * `message_log`, no `sent_count`. It still travels the queue so a test can
 * never bypass the rate limiter (CLAUDE.md rule 3).
 */
export interface BroadcastTestJob {
  tenantId: string;
  text: string;
  testChatId: number;
  broadcastId?: undefined;
  customerId?: undefined;
}

/**
 * Either shape, discriminated by `testChatId`. Jobs enqueued by an older
 * deploy have no such field and narrow to the fan-out branch, so a rollout
 * mid-broadcast keeps working.
 */
export type BroadcastJob = BroadcastFanoutJob | BroadcastTestJob;

/** Whether a delivery is the K1 test rather than a real recipient. */
export function isBroadcastTest(job: BroadcastJob): job is BroadcastTestJob {
  return job.testChatId != null;
}

/**
 * What the stop control does right now (§5.8). Before the hold window closes
 * it cancels everything; after, it stops what has not gone out yet. Two
 * labels, one action — the difference is only what has already happened.
 */
export function broadcastHoldRemainingMs(
  createdAt: Date,
  now: Date = new Date(),
): number {
  const elapsed = now.getTime() - createdAt.getTime();
  return Math.max(0, BROADCAST_HOLD_SECONDS * 1000 - elapsed);
}

/**
 * Can this broadcast still be stopped? Only while it is `queued` AND has
 * deliveries left to make. A finished fan-out offers nothing to stop, and
 * saying otherwise would promise something the button cannot deliver.
 */
export function canStopBroadcast(b: {
  status: BroadcastStatus;
  sentCount: number;
  recipientCount: number;
}): boolean {
  return b.status === 'queued' && b.sentCount < b.recipientCount;
}
