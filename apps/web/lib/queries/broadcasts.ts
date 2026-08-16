/**
 * Broadcast / Xabarnoma (SPEC §5.8, §7.11).
 */

import 'server-only';

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueBroadcasts, enqueueBroadcastTest } from '@kargotrack/db/queue';
import { broadcasts, customers, type Broadcast } from '@kargotrack/db/schema';

/** Ids of a tenant's customers reachable on Telegram (broadcast recipients). */
export async function listCustomerIdsWithTelegram(
  tenantId: string,
): Promise<string[]> {
  const rows = await getDb()
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), isNotNull(customers.tgUserId)));
  return rows.map((r) => r.id);
}

/** Insert a broadcast record (sent_count starts at 0). Returns its id (§5.8). */
export async function createBroadcast(args: {
  tenantId: string;
  text: string;
  /** How many deliveries are being queued — frozen here (§7.11). */
  recipientCount: number;
  createdBy: string;
}): Promise<string> {
  const [row] = await getDb()
    .insert(broadcasts)
    .values({
      tenantId: args.tenantId,
      text: args.text,
      recipientCount: args.recipientCount,
      createdBy: args.createdBy,
    })
    .returning({ id: broadcasts.id });
  return row!.id;
}

/**
 * Create a broadcast and fan it out to one throttled-queue job per reachable
 * customer (SPEC §7.11). Returns how many recipients were enqueued.
 */
export async function sendBroadcast(args: {
  tenantId: string;
  text: string;
  createdBy: string;
}): Promise<{ broadcastId: string; count: number }> {
  const { tenantId, text } = args;
  const recipientIds = await listCustomerIdsWithTelegram(tenantId);
  const broadcastId = await createBroadcast({
    tenantId,
    text,
    recipientCount: recipientIds.length,
    createdBy: args.createdBy,
  });
  // Bulk-inserted in chunks, not one round trip per recipient — the admin's
  // request waits on this (AUDIT.md T3). Held for BROADCAST_HOLD_SECONDS so
  // the row exists, and can be cancelled, before anything leaves (§7.11).
  await enqueueBroadcasts(
    recipientIds.map((customerId) => ({
      tenantId,
      broadcastId,
      customerId,
      text,
    })),
  );
  return { broadcastId, count: recipientIds.length };
}

/**
 * Stop a broadcast (SPEC §5.8, §7.11 — D-008). One UPDATE: the bot worker
 * re-reads this row before every delivery, so inside the hold window this
 * reaches nobody and after it the remainder is never sent. Already-cancelled
 * rows are left alone, so the first person to press it is the one recorded.
 */
export async function cancelBroadcast(args: {
  tenantId: string;
  broadcastId: string;
  cancelledBy: string;
}): Promise<boolean> {
  const rows = await getDb()
    .update(broadcasts)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: args.cancelledBy,
    })
    .where(
      and(
        eq(broadcasts.tenantId, args.tenantId),
        eq(broadcasts.id, args.broadcastId),
        eq(broadcasts.status, 'queued'),
        // There is no terminal state (§7.11), so "queued" alone would let a
        // fan-out that already reached everybody be stamped `cancelled` — a
        // history row reading "5 / 5 sent · Cancelled". Stopping something
        // that has finished is a no-op, and the record must say so.
        sql`${broadcasts.sentCount} < ${broadcasts.recipientCount}`,
      ),
    )
    .returning({ id: broadcasts.id });
  return rows.length > 0;
}

/**
 * Queue the K1 test delivery to an employee's own chat (§5.8). Writes nothing:
 * a test is not a broadcast, so there is no row to count it toward.
 */
export async function sendBroadcastTest(args: {
  tenantId: string;
  text: string;
  chatId: number;
}): Promise<void> {
  await enqueueBroadcastTest({
    tenantId: args.tenantId,
    text: args.text,
    testChatId: args.chatId,
  });
}

/** Past broadcasts, newest first (SPEC §5.8 history). Tenant-scoped. */
export async function listBroadcasts(tenantId: string): Promise<Broadcast[]> {
  return getDb()
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.tenantId, tenantId))
    .orderBy(desc(broadcasts.createdAt));
}
