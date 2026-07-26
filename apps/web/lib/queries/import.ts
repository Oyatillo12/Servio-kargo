/**
 * Track-code import (SPEC §5.4, §7.2).
 */

import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotification } from '@kargotrack/db/queue';
import { trackEvents, tracks } from '@kargotrack/db/schema';
import {
  planStatusChange,
  type ImportCode,
  type TrackStatus,
} from '@kargotrack/shared';

import { chunked, IMPORT_CHUNK } from './internal';

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
  batchId: string | null = null,
): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = { created: 0, updated: 0, queued: 0 };
  if (codes.length === 0) return result;

  // Enqueued only AFTER the transaction commits: pg-boss writes through its own
  // connection, so a job sent mid-transaction would survive a rollback and
  // notify about rows that were never written.
  const toNotify: Array<{ trackId: string; customerId: string }> = [];

  // All writes in one transaction — an import either fully applies or not at all.
  await db.transaction(async (tx) => {
    // Preload existing rows for this batch in one query.
    const existingRows = await tx
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
    const existingByCode = new Map(
      existingRows.map((r) => [r.codeNormalized, r]),
    );

    // New codes → bulk insert. ON CONFLICT DO NOTHING absorbs a concurrent
    // import racing on the same (tenant, code): the loser's row silently skips
    // (not created, not updated this run) instead of aborting the whole import.
    const newCodes = codes.filter((c) => !existingByCode.has(c.normalized));
    for (const chunk of chunked(newCodes, IMPORT_CHUNK)) {
      const inserted = await tx
        .insert(tracks)
        .values(
          chunk.map((code) => ({
            tenantId,
            codeNormalized: code.normalized,
            codeOriginal: code.original,
            currentStatus: status,
            batchId,
          })),
        )
        .onConflictDoNothing({
          target: [tracks.tenantId, tracks.codeNormalized],
        })
        .returning({ id: tracks.id });
      if (inserted.length > 0) {
        await tx.insert(trackEvents).values(
          inserted.map((t) => ({
            trackId: t.id,
            status,
            meta: { source: 'import' },
            createdBy,
          })),
        );
      }
      result.created += inserted.length;
      // new tracks are unclaimed → no notification
    }

    // Existing codes → plan each row, then group ids by identical SET so every
    // group is one bulk UPDATE instead of a per-row round trip.
    const writeIds: string[] = []; // status change and/or revive
    const batchOnlyIds: string[] = []; // §7.2 batch attach on a §2 no-op row
    const eventIds: string[] = [];

    for (const code of codes) {
      const existing = existingByCode.get(code.normalized);
      if (!existing) continue;

      const plan = planStatusChange({
        previousStatus: existing.currentStatus,
        newStatus: status,
        customerId: existing.customerId,
        wasDeleted: existing.deletedAt != null,
      });
      // §7.2: a selected batch attaches to ALL rows, even ones whose status is
      // a §2 no-op. Skip only when there is nothing at all to write.
      if (plan.willWrite) writeIds.push(existing.id);
      else if (batchId != null) batchOnlyIds.push(existing.id);
      else continue;

      // §2: only a real status change appends an event.
      if (plan.willEvent) eventIds.push(existing.id);
      result.updated += 1;

      if (plan.willNotify) {
        toNotify.push({ trackId: existing.id, customerId: existing.customerId! });
      }
    }

    const writeSet: Partial<typeof tracks.$inferInsert> = {
      currentStatus: status,
      deletedAt: null,
    };
    if (batchId != null) writeSet.batchId = batchId;
    for (const chunk of chunked(writeIds, IMPORT_CHUNK)) {
      await tx.update(tracks).set(writeSet).where(inArray(tracks.id, chunk));
    }
    for (const chunk of chunked(batchOnlyIds, IMPORT_CHUNK)) {
      await tx.update(tracks).set({ batchId }).where(inArray(tracks.id, chunk));
    }
    for (const chunk of chunked(eventIds, IMPORT_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status,
          meta: { source: 'import' },
          createdBy,
        })),
      );
    }
  });

  for (const n of toNotify) {
    await enqueueNotification({
      tenantId,
      trackId: n.trackId,
      customerId: n.customerId,
      status,
    });
    result.queued += 1;
  }

  return result;
}
