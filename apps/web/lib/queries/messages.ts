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
