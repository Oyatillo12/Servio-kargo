/**
 * Delivery-outcome log writes (AUDIT.md T13). The worker records the FINAL
 * outcome of every outbound message here — sent, dropped (unreachable) or
 * failed (retries exhausted) — so the panel can answer "did the customer
 * actually get notified?".
 */

import { getDb } from '@kargotrack/db';
import {
  messageLog,
  type MessageDeliveryStatus,
  type MessageKind,
} from '@kargotrack/db/schema';

export interface MessageOutcome {
  tenantId: string;
  customerId: string;
  kind: MessageKind;
  status: MessageDeliveryStatus;
  trackId?: string;
  broadcastId?: string;
  error?: string;
}

/** Keep stored Telegram error descriptions short — diagnosis, not archive. */
const ERROR_MAX_LENGTH = 200;

export async function insertMessageOutcome(o: MessageOutcome): Promise<void> {
  const db = getDb();
  await db.insert(messageLog).values({
    tenantId: o.tenantId,
    customerId: o.customerId,
    kind: o.kind,
    status: o.status,
    trackId: o.trackId,
    broadcastId: o.broadcastId,
    error: o.error ? o.error.slice(0, ERROR_MAX_LENGTH) : undefined,
  });
}
