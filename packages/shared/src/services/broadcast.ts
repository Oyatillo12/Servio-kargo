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

export interface BroadcastJob {
  tenantId: string;
  /** The `broadcasts` row this delivery counts toward. */
  broadcastId: string;
  customerId: string;
  /** The admin's text, sent as-is — no wrapper (§4.5). */
  text: string;
}
