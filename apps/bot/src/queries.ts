/**
 * Tenant-scoped database access for the bot. Every query is filtered by
 * `tenant_id` (CLAUDE.md rule 1). Handlers call these helpers and delegate all
 * decisions/formatting to `@kargotrack/shared`, so they stay thin.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  customers,
  payments,
  tenants,
  trackEvents,
  tracks,
  type Customer,
  type Payment,
  type Tenant,
  type Track,
} from '@kargotrack/db/schema';
import { type Lang, nextClientCode } from '@kargotrack/shared';

import { logger } from './logger';

/** Postgres unique-violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = '23505';
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return row;
}

export async function getTenantByToken(
  token: string,
): Promise<Tenant | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.botToken, token))
    .limit(1);
  return row;
}

export async function listTenants(): Promise<Tenant[]> {
  return getDb().select().from(tenants);
}

export async function getCustomerByTg(
  tenantId: string,
  tgUserId: number,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.tgUserId, tgUserId)),
    )
    .limit(1);
  return row;
}

/**
 * Register (or return the existing) customer for a Telegram user. Assigns
 * `client_code = prefix + '-' + sequence` and retries on the unique-index
 * collision that a concurrent registration could cause.
 */
export async function registerCustomer(args: {
  tenant: Tenant;
  tgUserId: number;
  phone: string;
  fullName: string;
  lang: Lang;
}): Promise<Customer> {
  const db = getDb();
  const { tenant, tgUserId, phone, fullName, lang } = args;

  // A concurrent contact may have already created this customer.
  const existing = await getCustomerByTg(tenant.id, tgUserId);
  if (existing) {
    const [updated] = await db
      .update(customers)
      .set({ phone, fullName, lang })
      .where(eq(customers.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const codeRows = await db
      .select({ clientCode: customers.clientCode })
      .from(customers)
      .where(eq(customers.tenantId, tenant.id));
    const clientCode = nextClientCode(
      tenant.codePrefix,
      codeRows.map((r) => r.clientCode),
    );

    try {
      const [row] = await db
        .insert(customers)
        .values({
          tenantId: tenant.id,
          tgUserId,
          phone,
          fullName,
          clientCode,
          lang,
        })
        .returning();
      if (row) return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Could be a client_code race (retry) or a tg_user race (return theirs).
      const raced = await getCustomerByTg(tenant.id, tgUserId);
      if (raced) return raced;
      logger.warn(
        { attempt, tenantId: tenant.id },
        'client_code collision, retrying',
      );
    }
  }
  throw new Error('registerCustomer: exhausted client_code retries');
}

export async function setCustomerLang(
  customerId: string,
  lang: Lang,
): Promise<void> {
  await getDb()
    .update(customers)
    .set({ lang })
    .where(eq(customers.id, customerId));
}

/** Non-deleted tracks for a customer (tenant-scoped). */
export async function listCustomerTracks(
  tenantId: string,
  customerId: string,
): Promise<Track[]> {
  const db = getDb();
  return db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    );
}

export async function listCustomerPayments(
  tenantId: string,
  customerId: string,
): Promise<Payment[]> {
  const db = getDb();
  return db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));
}

/** A single track by id (tenant-scoped), including soft-deleted rows. */
export async function getTrackById(
  tenantId: string,
  trackId: string,
): Promise<Track | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), eq(tracks.id, trackId)))
    .limit(1);
  return row;
}

/** A single customer by id (tenant-scoped). */
export async function getCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  return row;
}

/** Find a (non-deleted) track by normalized code within a tenant. */
export async function findTrackByCode(
  tenantId: string,
  codeNormalized: string,
): Promise<Track | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.codeNormalized, codeNormalized),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row;
}

/** Create a new CREATED track attached to a customer, plus its audit event. */
export async function createTrackForCustomer(args: {
  tenantId: string;
  customerId: string;
  codeNormalized: string;
  codeOriginal: string;
  createdBy: string;
}): Promise<void> {
  const db = getDb();
  const [track] = await db
    .insert(tracks)
    .values({
      tenantId: args.tenantId,
      customerId: args.customerId,
      codeNormalized: args.codeNormalized,
      codeOriginal: args.codeOriginal,
      currentStatus: 'CREATED',
    })
    .returning();
  if (!track) return;
  await db.insert(trackEvents).values({
    trackId: track.id,
    status: 'CREATED',
    meta: { source: 'bot' },
    createdBy: args.createdBy,
  });
}

/**
 * Attach an unclaimed track to a customer. Guarded by `customer_id IS NULL` so a
 * concurrent claim can't steal it; returns whether the claim succeeded.
 */
export async function claimTrack(
  trackId: string,
  customerId: string,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .update(tracks)
    .set({ customerId })
    .where(and(eq(tracks.id, trackId), isNull(tracks.customerId)))
    .returning({ id: tracks.id });
  return rows.length > 0;
}

/** Timestamp of the most recent audit event for a track (SPEC §3.6). */
export async function getLastEventAt(trackId: string): Promise<Date | null> {
  const db = getDb();
  const [row] = await db
    .select({ createdAt: trackEvents.createdAt })
    .from(trackEvents)
    .where(eq(trackEvents.trackId, trackId))
    .orderBy(desc(trackEvents.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}
