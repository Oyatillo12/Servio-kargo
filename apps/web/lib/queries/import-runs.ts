/**
 * Import runs and their undo (SPEC §7.18, tasks.md M — D-010).
 *
 * The rules live in `@kargotrack/shared` (`planImportUndoRow`, the window);
 * this module is the tenant-scoped reading and writing around them. Nothing
 * here decides WHETHER a row may be reverted — it only asks, and applies the
 * answer.
 */

import 'server-only';

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import {
  adminUsers,
  importRuns,
  messageLog,
  trackEvents,
  tracks,
} from '@kargotrack/db/schema';
import {
  BULK_CHUNK,
  chunked,
  importUndoState,
  planImportUndoRow,
  type ImportRejectedRow,
  type ImportRunField,
  type ImportRunItem,
  type ImportRunValues,
  type ImportUndoResult,
  type ImportUndoState,
  type TrackStatus,
} from '@kargotrack/shared';

/** One row of the §5.4 `Oxirgi importlar` card. */
export interface ImportRunSummary {
  id: string;
  createdAt: Date;
  /** Who applied it; null once the employee's account is gone. */
  createdByName: string | null;
  status: TrackStatus;
  sourceName: string | null;
  created: number;
  updated: number;
  assigned: number;
  enriched: number;
  queued: number;
  rejected: number;
  undoneAt: Date | null;
  undoneReverted: number | null;
  undoneSkipped: number | null;
  /** Whether the undo control is offered right now, and if not, why. */
  undo: ImportUndoState;
  /** Evidence pruned by the sweep — the undo cannot run even inside the window. */
  evidenceGone: boolean;
}

/** How many runs the card lists. Enough to cover a day of imports. */
const RUN_LIST_LIMIT = 10;

/** This tenant's most recent import runs, newest first (§5.4). */
export async function listImportRuns(
  tenantId: string,
  limit = RUN_LIST_LIMIT,
): Promise<ImportRunSummary[]> {
  const rows = await getDb()
    .select({
      id: importRuns.id,
      createdAt: importRuns.createdAt,
      createdByName: adminUsers.fullName,
      status: importRuns.status,
      sourceName: importRuns.sourceName,
      created: importRuns.createdCount,
      updated: importRuns.updatedCount,
      assigned: importRuns.assignedCount,
      enriched: importRuns.enrichedCount,
      queued: importRuns.queuedCount,
      rejected: importRuns.rejectedCount,
      undoneAt: importRuns.undoneAt,
      undoneReverted: importRuns.undoneReverted,
      undoneSkipped: importRuns.undoneSkipped,
      // The blob itself is never selected — a run list must not drag ten
      // thousand items into memory to say whether an undo is still possible.
      hasItems: sql<boolean>`${importRuns.items} IS NOT NULL`,
    })
    .from(importRuns)
    .leftJoin(adminUsers, eq(adminUsers.id, importRuns.createdBy))
    .where(eq(importRuns.tenantId, tenantId))
    .orderBy(desc(importRuns.createdAt))
    .limit(limit);

  const now = new Date();
  return rows.map(({ hasItems, ...run }) => ({
    ...run,
    undo: importUndoState(run, now),
    evidenceGone: !hasItems,
  }));
}

/** The problem rows a run stored, for the M3 export. Tenant-scoped. */
export async function getImportRunRejected(
  tenantId: string,
  runId: string,
): Promise<{ rows: ImportRejectedRow[]; total: number; at: Date } | null> {
  const [row] = await getDb()
    .select({
      rejected: importRuns.rejected,
      total: importRuns.rejectedCount,
      at: importRuns.createdAt,
    })
    .from(importRuns)
    .where(and(eq(importRuns.tenantId, tenantId), eq(importRuns.id, runId)))
    .limit(1);
  if (!row) return null;
  return {
    rows: (row.rejected as ImportRejectedRow[] | null) ?? [],
    total: row.total,
    at: row.at,
  };
}

/** Why an undo could not run — the panel turns these into finished text. */
export type ImportUndoFailure =
  | 'notFound'
  | 'expired'
  | 'alreadyUndone'
  | 'evidenceGone';

export type ImportUndoOutcome =
  | ({ ok: true } & ImportUndoResult)
  | { ok: false; reason: ImportUndoFailure };

/** The transaction's own result: the outcome plus what it looked at. */
type UndoTxOutcome =
  | ({ ok: true; trackIds: string[] } & ImportUndoResult)
  | { ok: false; reason: ImportUndoFailure };

/** Postgres column and cast per restorable field — the undo writes real NULLs. */
const FIELD_SQL: Record<ImportRunField, { column: string; cast: string }> = {
  currentStatus: { column: 'current_status', cast: 'track_status' },
  batchId: { column: 'batch_id', cast: 'uuid' },
  deletedAt: { column: 'deleted_at', cast: 'timestamptz' },
  customerId: { column: 'customer_id', cast: 'uuid' },
  weightGrams: { column: 'weight_grams', cast: 'integer' },
  priceTiyin: { column: 'price_tiyin', cast: 'bigint' },
  priceUsdCents: { column: 'price_usd_cents', cast: 'bigint' },
  usdRateUsed: { column: 'usd_rate_used', cast: 'bigint' },
  tariffId: { column: 'tariff_id', cast: 'uuid' },
  priceManual: { column: 'price_manual', cast: 'boolean' },
  marka: { column: 'marka', cast: 'text' },
  description: { column: 'description', cast: 'text' },
  volumetricGrams: { column: 'volumetric_grams', cast: 'integer' },
};

/** The track columns an undo compares against, as jsonb-shaped scalars. */
function currentValues(row: {
  currentStatus: TrackStatus;
  batchId: string | null;
  deletedAt: Date | null;
  customerId: string | null;
  weightGrams: number | null;
  priceTiyin: number | null;
  priceUsdCents: number | null;
  usdRateUsed: number | null;
  tariffId: string | null;
  priceManual: boolean;
  marka: string | null;
  description: string | null;
  volumetricGrams: number | null;
}): ImportRunValues {
  return {
    ...row,
    // `items` stores timestamps as ISO strings (jsonb has no date type), so the
    // comparison is scalar equality on both sides or it is nothing.
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/** One row the undo will restore. */
interface Revert {
  id: string;
  set: ImportRunValues;
  /** The status the track ends up with — what the audit event records. */
  status: TrackStatus;
}

/**
 * Take back an import (§7.18, D-010).
 *
 * Runs in one transaction, and locks the run row first: pressing the button
 * twice, or from two devices, must undo once. Rows changed since the import are
 * skipped and counted rather than half-reverted — see `planImportUndoRow` for
 * why that decision is per row and not per column.
 *
 * Sends nothing. The customers who were already told are reported as a number,
 * because a correction message about a parcel whose owner may never have read
 * the first one is a second wrong message, not a fix (§7.3's reasoning).
 */
export async function undoImportRun(args: {
  tenantId: string;
  runId: string;
  undoneBy: string;
}): Promise<ImportUndoOutcome> {
  const db = getDb();
  const outcome = await db.transaction(
    async (tx): Promise<UndoTxOutcome> => {
      const [run] = await tx
        .select({
          id: importRuns.id,
          createdAt: importRuns.createdAt,
          undoneAt: importRuns.undoneAt,
          queued: importRuns.queuedCount,
          items: importRuns.items,
        })
        .from(importRuns)
        .where(
          and(eq(importRuns.tenantId, args.tenantId), eq(importRuns.id, args.runId)),
        )
        .limit(1)
        .for('update');

      if (!run) return { ok: false, reason: 'notFound' };
      const state = importUndoState(run);
      if (state === 'undone') return { ok: false, reason: 'alreadyUndone' };
      if (state === 'expired') return { ok: false, reason: 'expired' };

      const items = (run.items as ImportRunItem[] | null) ?? null;
      if (items == null) return { ok: false, reason: 'evidenceGone' };

      const softDeleteIds: string[] = [];
      const reverts: Revert[] = [];
      let skipped = 0;

      for (const chunk of chunked(items, BULK_CHUNK)) {
        const current = await tx
          .select({
            id: tracks.id,
            currentStatus: tracks.currentStatus,
            batchId: tracks.batchId,
            deletedAt: tracks.deletedAt,
            customerId: tracks.customerId,
            weightGrams: tracks.weightGrams,
            priceTiyin: tracks.priceTiyin,
            priceUsdCents: tracks.priceUsdCents,
            usdRateUsed: tracks.usdRateUsed,
            tariffId: tracks.tariffId,
            priceManual: tracks.priceManual,
            marka: tracks.marka,
            description: tracks.description,
            volumetricGrams: tracks.volumetricGrams,
          })
          .from(tracks)
          .where(
            and(
              eq(tracks.tenantId, args.tenantId),
              inArray(
                tracks.id,
                chunk.map((i) => i.trackId),
              ),
            ),
          );
        const byId = new Map(current.map((r) => [r.id, r]));

        for (const item of chunk) {
          const row = byId.get(item.trackId);
          const plan = planImportUndoRow(
            item,
            row ? currentValues(row) : null,
          );
          if (plan.action === 'skip') {
            skipped++;
            continue;
          }
          if (plan.softDelete) {
            softDeleteIds.push(item.trackId);
          } else {
            reverts.push({
              id: item.trackId,
              set: plan.set,
              status:
                (plan.set.currentStatus as TrackStatus | undefined) ??
                row!.currentStatus,
            });
          }
        }
      }

      for (const chunk of chunked(softDeleteIds, BULK_CHUNK)) {
        await tx
          .update(tracks)
          .set({ deletedAt: new Date() })
          .where(
            and(eq(tracks.tenantId, args.tenantId), inArray(tracks.id, chunk)),
          );
      }

      // Rows written by one import share the same shape (a status, a weight,
      // an owner…), so grouping by that shape turns thousands of per-row
      // updates into a handful of statements. COALESCE is not an option here:
      // restoring a field to NULL is exactly what this has to do.
      const groups = new Map<string, Revert[]>();
      for (const r of reverts) {
        const key = Object.keys(r.set).sort().join(',');
        const group = groups.get(key);
        if (group) group.push(r);
        else groups.set(key, [r]);
      }
      for (const [key, group] of groups) {
        if (key === '') continue;
        const fields = key.split(',') as ImportRunField[];
        const columns = fields.map((f) => FIELD_SQL[f].column);
        for (const chunk of chunked(group, BULK_CHUNK)) {
          const values = sql.join(
            chunk.map((r) =>
              sql`(${sql.join(
                [
                  sql`${r.id}::uuid`,
                  ...fields.map(
                    (f) =>
                      sql`${r.set[f] ?? null}::${sql.raw(FIELD_SQL[f].cast)}`,
                  ),
                ],
                sql`, `,
              )})`,
            ),
            sql`, `,
          );
          await tx.execute(sql`
            UPDATE ${tracks} AS t SET ${sql.raw(
              columns.map((c) => `${c} = v.${c}`).join(', '),
            )}
            FROM (VALUES ${values}) AS v(id, ${sql.raw(columns.join(', '))})
            WHERE t.id = v.id AND t.tenant_id = ${args.tenantId}::uuid
          `);
        }
      }

      // Rule 7: history is appended, never rewritten. A revert is a new row
      // carrying the status the track ends up with. Created rows that were
      // soft-deleted get none — that matches every other soft-delete here.
      for (const chunk of chunked(reverts, BULK_CHUNK)) {
        await tx.insert(trackEvents).values(
          chunk.map((r) => ({
            trackId: r.id,
            status: r.status,
            meta: { source: 'import-undo', runId: args.runId },
            createdBy: args.undoneBy,
          })),
        );
      }

      const reverted = softDeleteIds.length + reverts.length;
      await tx
        .update(importRuns)
        .set({
          undoneAt: new Date(),
          undoneBy: args.undoneBy,
          undoneReverted: reverted,
          undoneSkipped: skipped,
        })
        .where(eq(importRuns.id, args.runId));

      return {
        ok: true,
        reverted,
        skipped,
        notified: 0,
        trackIds: items.map((i) => i.trackId),
      };
    },
  );

  if (!outcome.ok) return outcome;

  // Counted after the commit, so it says what actually went out — the jobs
  // still held are dropped by the worker the moment the run reads as undone.
  const { trackIds, ...result } = outcome;
  return { ...result, notified: await countDeliveredForRun(args, trackIds) };
}

/**
 * How many of this run's notifications Telegram actually took (§7.18).
 *
 * `message_log` has no run column, so the count is "sent notifications about
 * these tracks since the run started". One deliberate query on a rare, manual
 * action — the alternative was a column on every message row.
 */
async function countDeliveredForRun(
  args: { tenantId: string; runId: string },
  trackIds: string[],
): Promise<number> {
  if (trackIds.length === 0) return 0;
  const db = getDb();
  const [run] = await db
    .select({ at: importRuns.createdAt })
    .from(importRuns)
    .where(
      and(eq(importRuns.tenantId, args.tenantId), eq(importRuns.id, args.runId)),
    )
    .limit(1);
  if (!run) return 0;

  let total = 0;
  for (const chunk of chunked(trackIds, BULK_CHUNK)) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(messageLog)
      .where(
        and(
          eq(messageLog.tenantId, args.tenantId),
          eq(messageLog.kind, 'notify'),
          eq(messageLog.status, 'sent'),
          gte(messageLog.createdAt, run.at),
          inArray(messageLog.trackId, chunk),
        ),
      );
    total += row?.n ?? 0;
  }
  return total;
}
