/**
 * Tenant-scoped database access for the admin panel. EVERY query filters by the
 * caller-supplied `tenantId` (CLAUDE.md rule 1) — that id always comes from the
 * session (`requireAdmin`), never from user input.
 */

import 'server-only';

import { and, asc, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  customers,
  payments,
  trackEvents,
  tracks,
  type Customer,
  type Track,
  type TrackEvent,
} from '@kargotrack/db/schema';
import {
  computeDebtTiyin,
  normalizeCode,
  type DebtTrack,
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
