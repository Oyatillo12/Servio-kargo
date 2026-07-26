/**
 * Queue-worker contexts (AUDIT.md T3): everything one job needs, in one round
 * trip, plus the broadcast delivery counter the same workers bump.
 */

import { and, eq, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  batches,
  broadcasts,
  customers,
  tenants,
  tracks,
  type Batch,
  type Customer,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';

/**
 * Everything the notification worker needs for one message, in one round trip.
 *
 * It used to run four sequential queries (tenant → track → customer → batch),
 * each a full network round trip before the send could even start. At a few
 * hundred messages that is most of the wall clock, and with the batched worker
 * it is also four pooled connections held per in-flight job instead of one.
 *
 * The FROM side is `tenants` so a missing track and a missing customer stay
 * distinguishable from a missing tenant — the three cases are logged (and
 * dropped) differently. Every join is tenant-scoped (CLAUDE.md rule 1).
 */
export interface NotifyContext {
  tenant: Tenant;
  track: Track | null;
  customer: Customer | null;
  /** The track's batch, for the §4.2 IN_TRANSIT ETA line. */
  batch: Batch | null;
}

export async function getNotifyContext(
  tenantId: string,
  trackId: string,
  customerId: string,
): Promise<NotifyContext | undefined> {
  const db = getDb();
  const [row] = await db
    .select({
      tenant: tenants,
      track: tracks,
      customer: customers,
      batch: batches,
    })
    .from(tenants)
    .leftJoin(
      tracks,
      and(eq(tracks.id, trackId), eq(tracks.tenantId, tenants.id)),
    )
    .leftJoin(
      customers,
      and(eq(customers.id, customerId), eq(customers.tenantId, tenants.id)),
    )
    .leftJoin(
      batches,
      and(eq(batches.id, tracks.batchId), eq(batches.tenantId, tenants.id)),
    )
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return row ? { ...row } : undefined;
}

/**
 * Tenant + customer for the reminder and broadcast workers, in one round trip
 * (same rationale as {@link getNotifyContext}). `undefined` means the tenant is
 * gone; a null `customer` means the customer is.
 */
export interface SendContext {
  tenant: Tenant;
  customer: Customer | null;
}

export async function getSendContext(
  tenantId: string,
  customerId: string,
): Promise<SendContext | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ tenant: tenants, customer: customers })
    .from(tenants)
    .leftJoin(
      customers,
      and(eq(customers.id, customerId), eq(customers.tenantId, tenants.id)),
    )
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return row ? { ...row } : undefined;
}

/** Bump a broadcast's delivered count by one (SPEC §5.8 / §7.11). Tenant-scoped. */
export async function incrementBroadcastSent(
  tenantId: string,
  broadcastId: string,
): Promise<void> {
  await getDb()
    .update(broadcasts)
    .set({ sentCount: sql`${broadcasts.sentCount} + 1` })
    .where(
      and(eq(broadcasts.tenantId, tenantId), eq(broadcasts.id, broadcastId)),
    );
}
