/**
 * The tracks-list WHERE clause, shared by the paged list and its Excel export
 * (SPEC §5.2 / AUDIT.md T2) — it lives alone so neither module owns it.
 */

import 'server-only';

import { and, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { customers, trackEvents, tracks } from '@kargotrack/db/schema';
import {
  normalizeCode,
  stalePickupCutoff,
  type TrackStatus,
  type TrackWorklist,
} from '@kargotrack/shared';

/** Filter args shared by the paged tracks list and its Excel export. */
export interface TrackFilter {
  tenantId: string;
  q?: string;
  status?: TrackStatus;
  batchId?: string;
  /** Operational worklist (AUDIT.md T19) — a saved filter, see below. */
  work?: TrackWorklist;
  /** "Now" for the time-based worklist; injected so it can be tested. */
  now?: Date;
}

/**
 * The condition behind one dashboard worklist (AUDIT.md T19).
 *
 * This is the only definition of each queue: the dashboard counts with
 * `count(*) FILTER (WHERE …)` over exactly these predicates and `/tracks?work=`
 * lists them with the same ones, so the number on the card is always the number
 * of rows the admin lands on. Callers add the tenant + soft-delete scope.
 */
export function trackWorklistCondition(work: TrackWorklist, now: Date): SQL {
  switch (work) {
    // Nobody owns these yet — no notification, no debt, invisible in the
    // customer's "Mening yuklarim" until an admin attaches them (§5.3).
    case 'unassigned':
      return isNull(tracks.customerId);

    // Arrived in Guangzhou but never put on the scale, so they carry no price.
    case 'to_weigh':
      return and(
        eq(tracks.currentStatus, 'CHINA_WAREHOUSE'),
        isNull(tracks.weightGrams),
      )!;

    // Ready in Tashkent for longer than the threshold. "How long" comes from
    // the audit log, not `tracks` — the row has no status timestamp, and
    // `created_at` is when the code was imported, which for a re-imported code
    // can be months off. MAX() (not EXISTS) so a track that went
    // READY → DELIVERED → READY again is judged by its *latest* readiness.
    // `created_at` is the fallback for the rare row whose event log predates
    // the current status. The cutoff goes in as an explicit `::timestamptz`
    // ISO string: inside a raw template drizzle binds the value without a
    // column mapper, and postgres.js cannot serialize a bare `Date`.
    case 'stale_pickup':
      return and(
        eq(tracks.currentStatus, 'READY_FOR_PICKUP'),
        sql`coalesce(
              (select max(${trackEvents.createdAt})
                 from ${trackEvents}
                where ${trackEvents.trackId} = ${tracks.id}
                  and ${trackEvents.status} = 'READY_FOR_PICKUP'),
              ${tracks.createdAt}
            ) < ${stalePickupCutoff(now).toISOString()}::timestamptz`,
      )!;
  }
}

/**
 * The tracks-list WHERE (search + status + batch + worklist + soft-delete).
 * Built once and reused by {@link listTracks} and {@link listTracksForExport}
 * so "⬇️ Excel" can never hand back a different row set than the screen it was
 * clicked from. Callers must join `customers` — the search touches its columns.
 *
 * The return type is annotated rather than inferred on purpose: as a
 * cross-module export, an inferred drizzle condition type is large enough to
 * blow tsc's heap.
 */
export function tracksFilter(args: TrackFilter): SQL | undefined {
  const conds = [eq(tracks.tenantId, args.tenantId), isNull(tracks.deletedAt)];
  if (args.status) conds.push(eq(tracks.currentStatus, args.status));
  if (args.batchId) conds.push(eq(tracks.batchId, args.batchId));
  if (args.work) {
    conds.push(trackWorklistCondition(args.work, args.now ?? new Date()));
  }

  const q = args.q?.trim();
  if (q) {
    const like = `%${q}%`;
    const norm = normalizeCode(q);
    const searchConds = [
      ilike(customers.fullName, like),
      ilike(customers.phone, like),
      ilike(customers.clientCode, like),
      // §7.13: what the box says — the way a disputed parcel is found again.
      ilike(tracks.marka, like),
    ];
    searchConds.push(
      norm ? ilike(tracks.codeNormalized, `%${norm}%`) : ilike(tracks.codeOriginal, like),
    );
    conds.push(or(...searchConds)!);
  }
  return and(...conds);
}
