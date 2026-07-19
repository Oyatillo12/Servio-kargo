/**
 * Tenant-scoped database access for the admin panel. EVERY query filters by the
 * caller-supplied `tenantId` (CLAUDE.md rule 1) — that id always comes from the
 * session (`requireAdmin`), never from user input.
 */

import 'server-only';

import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification, enqueueReminder } from '@kargotrack/db/queue';
import {
  customers,
  payments,
  trackEvents,
  tracks,
  type Customer,
  type Payment,
  type Track,
  type TrackEvent,
} from '@kargotrack/db/schema';
import {
  computeDebtTiyin,
  normalizeCode,
  shouldEnqueueNotification,
  type DebtTrack,
  type ImportCode,
  type TrackStatus,
} from '@kargotrack/shared';

export const TRACKS_PAGE_SIZE = 20;

// --- Tracks list (SPEC §5.2) ------------------------------------------------

export interface TrackListRow {
  id: string;
  codeOriginal: string;
  currentStatus: TrackStatus;
  weightGrams: number | null;
  priceTiyin: number | null;
  createdAt: Date;
  customerId: string | null;
  customerName: string | null;
  clientCode: string | null;
}

export interface TrackListResult {
  rows: TrackListRow[];
  total: number;
  page: number;
  pages: number;
}

/**
 * Search (code / customer name / phone) + status filter + pagination. The code
 * search normalizes the query the same way codes are stored (CLAUDE.md rule 4)
 * so `yt-7583` matches `YT7583…`.
 */
export async function listTracks(args: {
  tenantId: string;
  q?: string;
  status?: TrackStatus;
  page: number;
}): Promise<TrackListResult> {
  const db = getDb();

  const conds = [eq(tracks.tenantId, args.tenantId), isNull(tracks.deletedAt)];
  if (args.status) conds.push(eq(tracks.currentStatus, args.status));

  const q = args.q?.trim();
  if (q) {
    const like = `%${q}%`;
    const norm = normalizeCode(q);
    const searchConds = [
      ilike(customers.fullName, like),
      ilike(customers.phone, like),
      ilike(customers.clientCode, like),
    ];
    searchConds.push(
      norm ? ilike(tracks.codeNormalized, `%${norm}%`) : ilike(tracks.codeOriginal, like),
    );
    conds.push(or(...searchConds)!);
  }
  const where = and(...conds);

  const [totalRow] = await db
    .select({ value: count() })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(where);
  const total = totalRow?.value ?? 0;

  const pages = Math.max(1, Math.ceil(total / TRACKS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(args.page)), pages);
  const offset = (page - 1) * TRACKS_PAGE_SIZE;

  const rows = await db
    .select({
      id: tracks.id,
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      createdAt: tracks.createdAt,
      customerId: customers.id,
      customerName: customers.fullName,
      clientCode: customers.clientCode,
    })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(where)
    .orderBy(desc(tracks.createdAt))
    .limit(TRACKS_PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pages };
}

// --- Track detail (SPEC §5.3) -----------------------------------------------

export interface TrackDetail {
  track: Track;
  customer: Customer | null;
  events: TrackEvent[];
}

export async function getTrackDetail(
  tenantId: string,
  trackId: string,
): Promise<TrackDetail | null> {
  const db = getDb();

  const [track] = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.id, trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  if (!track) return null;

  let customer: Customer | null = null;
  if (track.customerId) {
    const [row] = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.tenantId, tenantId),
          eq(customers.id, track.customerId),
        ),
      )
      .limit(1);
    customer = row ?? null;
  }

  const events = await db
    .select()
    .from(trackEvents)
    .where(eq(trackEvents.trackId, track.id))
    .orderBy(desc(trackEvents.createdAt));

  return { track, customer, events };
}

/** The stored photo path for a track (tenant-scoped), or `null`. */
export async function getTrackPhotoPath(
  tenantId: string,
  trackId: string,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ photoPath: tracks.photoPath })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.id, trackId),
        isNull(tracks.deletedAt),
      ),
    )
    .limit(1);
  return row?.photoPath ?? null;
}

/** Update a track's weight (grams) + recomputed price (tiyin), tenant-scoped. */
export async function setTrackWeight(args: {
  tenantId: string;
  trackId: string;
  weightGrams: number | null;
  priceTiyin: number | null;
}): Promise<void> {
  await getDb()
    .update(tracks)
    .set({ weightGrams: args.weightGrams, priceTiyin: args.priceTiyin })
    .where(
      and(
        eq(tracks.tenantId, args.tenantId),
        eq(tracks.id, args.trackId),
        isNull(tracks.deletedAt),
      ),
    );
}

// --- Customers list with debt (SPEC §5.5, debt per SPEC §7.5) ---------------

export interface CustomerRow {
  id: string;
  clientCode: string;
  fullName: string | null;
  phone: string | null;
  trackCount: number;
  debtTiyin: number;
}

/**
 * Customers (optionally filtered) with their non-deleted track count and net
 * debt. Debt is computed via the shared `computeDebtTiyin` service (SPEC §7.5):
 * we pull the tenant's non-deleted tracks and payments once and group in memory
 * — fine at MVP scale and keeps the tested pure function as the single source
 * of the debt rule.
 */
export async function listCustomersWithDebt(
  tenantId: string,
  q?: string,
): Promise<CustomerRow[]> {
  const db = getDb();

  const conds = [eq(customers.tenantId, tenantId)];
  const term = q?.trim();
  if (term) {
    const like = `%${term}%`;
    conds.push(
      or(
        ilike(customers.fullName, like),
        ilike(customers.phone, like),
        ilike(customers.clientCode, like),
      )!,
    );
  }
  const custs = await db
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(asc(customers.clientCode));

  const trackRows = await db
    .select({
      customerId: tracks.customerId,
      currentStatus: tracks.currentStatus,
      priceTiyin: tracks.priceTiyin,
      deletedAt: tracks.deletedAt,
    })
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));

  const payRows = await db
    .select({
      customerId: payments.customerId,
      amountTiyin: payments.amountTiyin,
    })
    .from(payments)
    .where(eq(payments.tenantId, tenantId));

  const tracksByCustomer = new Map<string, DebtTrack[]>();
  const countByCustomer = new Map<string, number>();
  for (const t of trackRows) {
    if (!t.customerId) continue;
    const list = tracksByCustomer.get(t.customerId) ?? [];
    list.push({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    });
    tracksByCustomer.set(t.customerId, list);
    countByCustomer.set(t.customerId, (countByCustomer.get(t.customerId) ?? 0) + 1);
  }

  const paymentsByCustomer = new Map<string, { amountTiyin: number }[]>();
  for (const p of payRows) {
    const list = paymentsByCustomer.get(p.customerId) ?? [];
    list.push({ amountTiyin: p.amountTiyin });
    paymentsByCustomer.set(p.customerId, list);
  }

  return custs.map((c) => ({
    id: c.id,
    clientCode: c.clientCode,
    fullName: c.fullName,
    phone: c.phone,
    trackCount: countByCustomer.get(c.id) ?? 0,
    debtTiyin: computeDebtTiyin(
      tracksByCustomer.get(c.id) ?? [],
      paymentsByCustomer.get(c.id) ?? [],
    ),
  }));
}

// --- Customer detail + payments (SPEC §5.5) ---------------------------------

export interface CustomerDetail {
  customer: Customer;
  tracks: Track[];
  payments: Payment[];
  debtTiyin: number;
}

/**
 * A customer with their non-deleted tracks, payment history (newest first) and
 * net debt (SPEC §7.5, via the shared `computeDebtTiyin`). Tenant-scoped.
 */
export async function getCustomerDetail(
  tenantId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const db = getDb();

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .limit(1);
  if (!customer) return null;

  const custTracks = await db
    .select()
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        eq(tracks.customerId, customerId),
        isNull(tracks.deletedAt),
      ),
    )
    .orderBy(desc(tracks.createdAt));

  const custPayments = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.tenantId, tenantId), eq(payments.customerId, customerId)),
    )
    .orderBy(desc(payments.createdAt));

  const debtTiyin = computeDebtTiyin(
    custTracks.map((t) => ({
      currentStatus: t.currentStatus,
      priceTiyin: t.priceTiyin,
      deletedAt: t.deletedAt,
    })),
    custPayments.map((p) => ({ amountTiyin: p.amountTiyin })),
  );

  return { customer, tracks: custTracks, payments: custPayments, debtTiyin };
}

/** Record a payment for a customer (amount in tiyin). Tenant-scoped (§5.5). */
export async function createPayment(args: {
  tenantId: string;
  customerId: string;
  amountTiyin: number;
  method: Payment['method'];
  note: string | null;
}): Promise<void> {
  await getDb().insert(payments).values({
    tenantId: args.tenantId,
    customerId: args.customerId,
    amountTiyin: args.amountTiyin,
    method: args.method,
    note: args.note,
  });
}

// --- Debtors (SPEC §5.6) ----------------------------------------------------

/** Customers with net debt > 0, sorted by debt descending (SPEC §5.6). */
export async function listDebtors(tenantId: string): Promise<CustomerRow[]> {
  const all = await listCustomersWithDebt(tenantId);
  return all
    .filter((c) => c.debtTiyin > 0)
    .sort((a, b) => b.debtTiyin - a.debtTiyin);
}

/**
 * Enqueue a manual debt reminder for a customer (SPEC §4.4). Fire-and-forget:
 * the bot's reminder worker re-checks the debt and sends, respecting rate
 * limits. Membership of the customer in this tenant is the caller's guarantee.
 */
export async function queueReminder(
  tenantId: string,
  customerId: string,
): Promise<void> {
  await enqueueReminder({ tenantId, customerId, reason: 'manual' });
}

// --- Import (SPEC §5.4, §7.2) -----------------------------------------------

/**
 * Which of `normalizedCodes` already exist for this tenant. Includes
 * soft-deleted rows because the (tenant_id, code_normalized) unique index does
 * — so the preview split matches what upsert can actually do (§7.2).
 */
export async function getExistingNormalizedCodes(
  tenantId: string,
  normalizedCodes: string[],
): Promise<Set<string>> {
  if (normalizedCodes.length === 0) return new Set();
  const rows = await getDb()
    .select({ code: tracks.codeNormalized })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        inArray(tracks.codeNormalized, normalizedCodes),
      ),
    );
  return new Set(rows.map((r) => r.code));
}

export interface ImportResult {
  created: number;
  updated: number;
  queued: number;
}

/**
 * Apply an import: upsert each code to `status` and append audit events (§7.2).
 * Existing rows only change (+ event + notify) when the status actually differs
 * or the row was soft-deleted (revived); same-status rows are no-ops (§2).
 * Every status change on an attached, non-deleted track enqueues a notification
 * (§4.2). New (unclaimed) tracks never notify.
 */
export async function applyImport(
  tenantId: string,
  status: TrackStatus,
  codes: ImportCode[],
  createdBy: string,
): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, queued: 0 };
  if (codes.length === 0) return result;

  // Preload existing rows for this batch in one query.
  const existingRows = await db
    .select({
      id: tracks.id,
      codeNormalized: tracks.codeNormalized,
      currentStatus: tracks.currentStatus,
      customerId: tracks.customerId,
      deletedAt: tracks.deletedAt,
    })
    .from(tracks)
    .where(
      and(
        eq(tracks.tenantId, tenantId),
        inArray(
          tracks.codeNormalized,
          codes.map((c) => c.normalized),
        ),
      ),
    );
  const existingByCode = new Map(existingRows.map((r) => [r.codeNormalized, r]));

  for (const code of codes) {
    const existing = existingByCode.get(code.normalized);

    if (!existing) {
      const [track] = await db
        .insert(tracks)
        .values({
          tenantId,
          codeNormalized: code.normalized,
          codeOriginal: code.original,
          currentStatus: status,
        })
        .returning({ id: tracks.id });
      if (track) {
        await db.insert(trackEvents).values({
          trackId: track.id,
          status,
          meta: { source: 'import' },
          createdBy,
        });
        result.created += 1;
      }
      continue; // new tracks are unclaimed → no notification
    }

    const statusChanged = existing.currentStatus !== status;
    const revived = existing.deletedAt != null;
    if (!statusChanged && !revived) continue; // §2 no-op

    await db
      .update(tracks)
      .set({ currentStatus: status, deletedAt: null })
      .where(eq(tracks.id, existing.id));
    // §2: only a real status change appends an event.
    if (statusChanged) {
      await db.insert(trackEvents).values({
        trackId: existing.id,
        status,
        meta: { source: 'import' },
        createdBy,
      });
    }
    result.updated += 1;

    if (
      shouldEnqueueNotification({
        previousStatus: existing.currentStatus,
        newStatus: status,
        customerId: existing.customerId,
      })
    ) {
      await enqueueNotification({
        tenantId,
        trackId: existing.id,
        customerId: existing.customerId!,
        status,
      });
      result.queued += 1;
    }
  }

  return result;
}
