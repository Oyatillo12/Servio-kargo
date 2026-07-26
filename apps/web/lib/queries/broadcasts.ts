/**
 * Broadcast / Xabarnoma (SPEC §5.8, §7.11).
 */

import 'server-only';

import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueBroadcasts } from '@kargotrack/db/queue';
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
export async function createBroadcast(
  tenantId: string,
  text: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(broadcasts)
    .values({ tenantId, text })
    .returning({ id: broadcasts.id });
  return row!.id;
}

/**
 * Create a broadcast and fan it out to one throttled-queue job per reachable
 * customer (SPEC §7.11). Returns how many recipients were enqueued.
 */
export async function sendBroadcast(
  tenantId: string,
  text: string,
): Promise<number> {
  const recipientIds = await listCustomerIdsWithTelegram(tenantId);
  const broadcastId = await createBroadcast(tenantId, text);
  // Bulk-inserted in chunks, not one round trip per recipient — the admin's
  // request waits on this (AUDIT.md T3).
  await enqueueBroadcasts(
    recipientIds.map((customerId) => ({
      tenantId,
      broadcastId,
      customerId,
      text,
    })),
  );
  return recipientIds.length;
}

/** Past broadcasts, newest first (SPEC §5.8 history). Tenant-scoped. */
export async function listBroadcasts(tenantId: string): Promise<Broadcast[]> {
  return getDb()
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.tenantId, tenantId))
    .orderBy(desc(broadcasts.createdAt));
}
