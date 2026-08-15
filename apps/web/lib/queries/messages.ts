/**
 * Delivery-outcome reads for the panel (AUDIT.md T13). Written by the bot
 * worker; the panel only ever reads, tenant-scoped like everything else here.
 */

import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  messageLog,
  type MessageDeliveryStatus,
  type MessageKind,
} from '@kargotrack/db/schema';

export interface CustomerMessageRow {
  id: string;
  kind: MessageKind;
  status: MessageDeliveryStatus;
  createdAt: Date;
}

/** Last `limit` outbound messages to one customer, newest first. */
export async function listCustomerMessages(
  tenantId: string,
  customerId: string,
  limit = 10,
): Promise<CustomerMessageRow[]> {
  const db = getDb();
  return db
    .select({
      id: messageLog.id,
      kind: messageLog.kind,
      status: messageLog.status,
      createdAt: messageLog.createdAt,
    })
    .from(messageLog)
    .where(
      and(
        eq(messageLog.tenantId, tenantId),
        eq(messageLog.customerId, customerId),
      ),
    )
    .orderBy(desc(messageLog.createdAt))
    .limit(limit);
}

/** Last `limit` outbound messages about one track, newest first (tasks.md A3). */
export async function listTrackMessages(
  tenantId: string,
  trackId: string,
  limit = 10,
): Promise<CustomerMessageRow[]> {
  const db = getDb();
  return db
    .select({
      id: messageLog.id,
      kind: messageLog.kind,
      status: messageLog.status,
      createdAt: messageLog.createdAt,
    })
    .from(messageLog)
    .where(
      and(eq(messageLog.tenantId, tenantId), eq(messageLog.trackId, trackId)),
    )
    .orderBy(desc(messageLog.createdAt))
    .limit(limit);
}

/**
 * Whether this customer's bot looks blocked: the LAST status notification was
 * permanently dropped (tasks.md A3). `dropped` only — `failed` means retries
 * ran out on a transient error, which says nothing about a block — and only
 * `notify`, because a reminder/broadcast may simply postdate an unblock.
 */
export async function isCustomerBotBlocked(
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ status: messageLog.status })
    .from(messageLog)
    .where(
      and(
        eq(messageLog.tenantId, tenantId),
        eq(messageLog.customerId, customerId),
        eq(messageLog.kind, 'notify'),
      ),
    )
    .orderBy(desc(messageLog.createdAt))
    .limit(1);
  return row?.status === 'dropped';
}
