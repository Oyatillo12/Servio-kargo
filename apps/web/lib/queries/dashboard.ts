/**
 * Owner dashboard stats + tushum chart (SPEC §5.10).
 */

import 'server-only';

import { and, count, eq, gte, inArray, isNull, lt, sql, sum } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  customers,
  messageLog,
  payments,
  trackEvents,
  tracks,
} from '@kargotrack/db/schema';
import {
  bucketDailyTushum,
  lastNDays,
  periodRange,
  TRACK_WORKLISTS,
  TUSHUM_CHART_DAYS,
  type DashboardPeriod,
  type TrackStatus,
  type TrackWorklist,
  type TushumPoint,
} from '@kargotrack/shared';

import { getDebtTotals } from './customers';
import { trackWorklistCondition } from './track-filter';

export interface DashboardStats {
  /** CHINA_WAREHOUSE events in the period. */
  chinaReceived: number;
  /** TASHKENT_WAREHOUSE events in the period. */
  tashkentArrived: number;
  /** DELIVERED events in the period, with the summed weight/price of the tracks. */
  delivered: { count: number; weightGrams: number; priceTiyin: number };
  /** Payments received in the period (tiyin). */
  tushumTiyin: number;
  /** Customers who registered in the period. */
  newCustomers: number;
  /**
   * Outbound messages that did NOT reach the customer in the period —
   * permanently dropped (bot blocked) plus retries-exhausted failures
   * (tasks.md A3). The number that used to be invisible.
   */
  undeliveredMessages: number;
  /** Current net debt across all debtors (tiyin) — NOT period-based. */
  debtTiyin: number;
  /** Current number of customers with net debt > 0 — NOT period-based. */
  debtorCount: number;
}

/**
 * The six §5.10 stat cards for `period`, via single tenant-scoped aggregate
 * queries (no N+1). Period windows are Asia/Tashkent calendar days resolved by
 * the tested `periodRange` (§7.9). Event-count and delivered cards join
 * `track_events → tracks` (events carry no tenant_id) and exclude soft-deleted
 * tracks (§7.8). Debt is current, not period-scoped, and comes from the
 * `getDebtTotals` aggregate (AUDIT.md T6) rather than a full debtor list.
 */
export async function getDashboardStats(
  tenantId: string,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<DashboardStats> {
  const db = getDb();
  const { startUtc, endUtc } = periodRange(now, period);

  const eventCount = async (status: TrackStatus): Promise<number> => {
    const [row] = await db
      .select({ value: count() })
      .from(trackEvents)
      .innerJoin(tracks, eq(trackEvents.trackId, tracks.id))
      .where(
        and(
          eq(tracks.tenantId, tenantId),
          isNull(tracks.deletedAt),
          eq(trackEvents.status, status),
          gte(trackEvents.createdAt, startUtc),
          lt(trackEvents.createdAt, endUtc),
        ),
      );
    return row?.value ?? 0;
  };

  const [
    chinaReceived,
    tashkentArrived,
    deliveredRow,
    tushumRow,
    custRow,
    undeliveredRow,
    debt,
  ] = await Promise.all([
      eventCount('CHINA_WAREHOUSE'),
      eventCount('TASHKENT_WAREHOUSE'),
      db
        .select({
          count: count(),
          weightGrams: sum(tracks.weightGrams),
          priceTiyin: sum(tracks.priceTiyin),
        })
        .from(trackEvents)
        .innerJoin(tracks, eq(trackEvents.trackId, tracks.id))
        .where(
          and(
            eq(tracks.tenantId, tenantId),
            isNull(tracks.deletedAt),
            eq(trackEvents.status, 'DELIVERED'),
            gte(trackEvents.createdAt, startUtc),
            lt(trackEvents.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ value: sum(payments.amountTiyin) })
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            gte(payments.createdAt, startUtc),
            lt(payments.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ value: count() })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            gte(customers.createdAt, startUtc),
            lt(customers.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      db
        .select({ value: count() })
        .from(messageLog)
        .where(
          and(
            eq(messageLog.tenantId, tenantId),
            inArray(messageLog.status, ['dropped', 'failed']),
            gte(messageLog.createdAt, startUtc),
            lt(messageLog.createdAt, endUtc),
          ),
        )
        .then((rows) => rows[0]),
      getDebtTotals(tenantId),
    ]);

  return {
    chinaReceived,
    tashkentArrived,
    delivered: {
      count: deliveredRow?.count ?? 0,
      weightGrams: Number(deliveredRow?.weightGrams ?? 0),
      priceTiyin: Number(deliveredRow?.priceTiyin ?? 0),
    },
    tushumTiyin: Number(tushumRow?.value ?? 0),
    newCustomers: custRow?.value ?? 0,
    undeliveredMessages: undeliveredRow?.value ?? 0,
    debtTiyin: debt.debtTiyin,
    debtorCount: debt.debtorCount,
  };
}

/** Pending-work counts, one entry per worklist (AUDIT.md T19). */
export type WorklistCounts = Record<TrackWorklist, number>;

/**
 * How many tracks are waiting in each operational worklist right now — the
 * "Bugungi ish" block (AUDIT.md T19). NOT period-scoped: a package that has sat
 * unweighed since last week is still today's work.
 *
 * One pass over the tenant's non-deleted tracks with a `FILTER` per worklist,
 * using the very conditions `/tracks?work=…` filters on
 * ({@link trackWorklistCondition}) — the card and the list it links to are the
 * same query, so a count can never send the admin to an empty screen.
 */
export async function getWorklistCounts(
  tenantId: string,
  now: Date = new Date(),
): Promise<WorklistCounts> {
  const selection = Object.fromEntries(
    TRACK_WORKLISTS.map((key) => [
      key,
      sql<number>`count(*) filter (where ${trackWorklistCondition(key, now)})::int`,
    ]),
  ) as Record<TrackWorklist, ReturnType<typeof sql<number>>>;

  const [row] = await getDb()
    .select(selection)
    .from(tracks)
    .where(and(eq(tracks.tenantId, tenantId), isNull(tracks.deletedAt)));

  return Object.fromEntries(
    TRACK_WORKLISTS.map((key) => [key, Number(row?.[key] ?? 0)]),
  ) as WorklistCounts;
}

/**
 * Daily tushum for the last 14 Tashkent days (§5.10 chart). One tenant-scoped
 * payments query over the whole window; buckets are assigned by the tested
 * `bucketDailyTushum`. Returns 14 points, oldest first, zero-filled.
 */
export async function getDailyTushum(
  tenantId: string,
  now: Date = new Date(),
): Promise<TushumPoint[]> {
  const buckets = lastNDays(now, TUSHUM_CHART_DAYS);
  const windowStart = buckets[0]!.startUtc;
  const windowEnd = buckets[buckets.length - 1]!.endUtc;

  const rows = await getDb()
    .select({ amountTiyin: payments.amountTiyin, createdAt: payments.createdAt })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        gte(payments.createdAt, windowStart),
        lt(payments.createdAt, windowEnd),
      ),
    );

  return bucketDailyTushum(buckets, rows);
}

export interface CashByStaffRow {
  adminUserId: string | null;
  /** Name, else phone, else null for payments recorded before T8. */
  name: string | null;
  totalTiyin: number;
  count: number;
}

/**
 * Today's cash, split by the employee who took it (AUDIT.md T8, SPEC §5.10).
 *
 * The reason the panel is worth paying for in a business that runs on cash: an
 * owner can close the day against what each person actually collected instead of
 * against one undifferentiated total. Owner-only — `money.reports` gates it, and
 * a manager seeing their colleagues' takings is a different product decision.
 *
 * Grouped in SQL, not in Node: this is a single aggregate over one day's rows
 * and it renders on the landing page of every owner's session.
 */
export async function getCashByStaff(
  tenantId: string,
  period: DashboardPeriod,
  now: Date = new Date(),
): Promise<CashByStaffRow[]> {
  const { startUtc, endUtc } = periodRange(now, period);

  const rows = await getDb()
    .select({
      adminUserId: payments.createdBy,
      fullName: adminUsers.fullName,
      phone: adminUsers.phone,
      totalTiyin: sql<number>`sum(${payments.amountTiyin})::bigint`,
      count: count(),
    })
    .from(payments)
    .leftJoin(adminUsers, eq(adminUsers.id, payments.createdBy))
    .where(
      and(
        eq(payments.tenantId, tenantId),
        gte(payments.createdAt, startUtc),
        lt(payments.createdAt, endUtc),
      ),
    )
    .groupBy(payments.createdBy, adminUsers.fullName, adminUsers.phone)
    .orderBy(sql`sum(${payments.amountTiyin}) DESC`);

  return rows.map((r) => ({
    adminUserId: r.adminUserId,
    name: r.fullName ?? r.phone,
    totalTiyin: Number(r.totalTiyin ?? 0),
    count: Number(r.count),
  }));
}
