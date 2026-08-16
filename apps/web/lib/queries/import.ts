/**
 * Track-code import (SPEC §5.4, §7.2, §7.3, §7.4).
 *
 * An import row can now carry more than a code: an owner, a weight and an
 * agreed price (column mapping, §5.4). The extra columns follow one rule —
 * **fill empty fields only**. A track already weighed on the Tashkent scales,
 * or already attached to a customer, is never overwritten by a file: the
 * warehouse is the source of truth for what it measured, and a re-imported
 * yesterday's Excel must not undo today's work.
 */

import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { enqueueNotifications } from '@kargotrack/db/queue';
import {
  importRuns,
  tenants,
  trackEvents,
  tracks,
} from '@kargotrack/db/schema';
import {
  BULK_CHUNK,
  IMPORT_NOTIFY_HOLD_SECONDS,
  MAX_REJECTED_ROWS,
  chunked,
  planAssignCustomer,
  planImportPricing,
  planStatusChange,
  readDimensions,
  type AssignEventMeta,
  type ImportCode,
  type ImportPricingContext,
  type ImportRejectedRow,
  type ImportRunField,
  type ImportRunItem,
  type ImportRunValues,
  type TrackStatus,
} from '@kargotrack/shared';

import { getDefaultTariff } from './tariffs';

/** What an existing track already holds — the fill-empty rule reads this. */
export interface ImportTarget {
  hasCustomer: boolean;
  hasWeight: boolean;
  hasPrice: boolean;
  hasMarka: boolean;
  hasDescription: boolean;
}

/**
 * Which of `normalizedCodes` already exist for this tenant, and which of the
 * mapped fields they already hold. Includes soft-deleted rows because the
 * (tenant_id, code_normalized) unique index does — so the preview split matches
 * what upsert can actually do (§7.2).
 *
 * The preview and the write share this so the numbers an admin confirms are the
 * numbers they get: a file that names an owner for 500 parcels attaches it to
 * the 200 that have none, and the preview says 200, not 500.
 */
export async function getImportTargets(
  tenantId: string,
  normalizedCodes: string[],
): Promise<Map<string, ImportTarget>> {
  const found = new Map<string, ImportTarget>();
  if (normalizedCodes.length === 0) return found;

  for (const chunk of chunked(normalizedCodes, BULK_CHUNK)) {
    const rows = await getDb()
      .select({
        code: tracks.codeNormalized,
        customerId: tracks.customerId,
        weightGrams: tracks.weightGrams,
        priceTiyin: tracks.priceTiyin,
        marka: tracks.marka,
        description: tracks.description,
      })
      .from(tracks)
      .where(
        and(
          eq(tracks.tenantId, tenantId),
          inArray(tracks.codeNormalized, chunk),
        ),
      );
    for (const row of rows) {
      found.set(row.code, {
        hasCustomer: row.customerId != null,
        hasWeight: row.weightGrams != null,
        hasPrice: row.priceTiyin != null,
        hasMarka: row.marka != null,
        hasDescription: row.description != null,
      });
    }
  }
  return found;
}

/** The pricing inputs an import needs, loaded once per run (§7.4). */
export async function getImportPricingContext(
  tenantId: string,
): Promise<ImportPricingContext> {
  const db = getDb();
  const [tenant] = await db
    .select({ currency: tenants.currency, usdRateTiyin: tenants.usdRateTiyin })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const tariff = await getDefaultTariff(tenantId);

  return {
    currency: tenant?.currency ?? 'UZS',
    usdRateTiyin: tenant?.usdRateTiyin ?? null,
    tariff: tariff
      ? {
          id: tariff.id,
          pricePerKgMinor: tariff.pricePerKgMinor,
          volumetricCoef: tariff.volumetricCoef,
        }
      : null,
  };
}

/** One import row: the code plus whatever the mapped columns supplied. */
export interface ImportRow extends ImportCode {
  /** Resolved owner, or null when the file had no owner column / no match. */
  customerId?: string | null;
  weightGrams?: number | null;
  /** Agreed so'm price from the file (tiyin) — a manual override (§7.4). */
  priceTiyin?: number | null;
  /**
   * Box marking (§7.13) — the owner cell as typed, only when it had the shape
   * of a client code. A name or phone is an owner reference, not a marking.
   */
  marka?: string | null;
  /** Goods description from the mapped column (§7.13). */
  description?: string | null;
}

export interface ImportResult {
  /** The `import_runs` row this apply left behind (§7.18). */
  runId: string;
  created: number;
  updated: number;
  queued: number;
  /** Tracks that gained an owner (new or previously unattached). */
  assigned: number;
  /** Tracks that gained a weight and/or a price. */
  enriched: number;
}

/** What the run row records besides the writes themselves (§7.18). */
export interface ImportRunSource {
  /** The .xlsx name, or null for pasted text. */
  sourceName: string | null;
  /** Rows the file could not deliver as-is — the M3 export (§7.18). */
  rejected: ImportRejectedRow[];
}

/** Enrichment write for one existing row; `null` fields are left untouched. */
interface EnrichWrite {
  id: string;
  customerId: string | null;
  weightGrams: number | null;
  priceTiyin: number | null;
  priceUsdCents: number | null;
  usdRateUsed: number | null;
  tariffId: string | null;
  priceManual: boolean | null;
  marka: string | null;
  description: string | null;
  /** Frozen volumetric weight when this row re-priced a measured parcel (§7.16). */
  volumetricGrams: number | null;
}

/**
 * Apply an import: upsert each code to `status`, fill the mapped columns and
 * append audit events (§7.2). Existing rows only change status (+ event +
 * notify) when the status actually differs or the row was soft-deleted
 * (revived); same-status rows are no-ops (§2) — but they still accept a batch
 * and still accept values for fields they are missing.
 *
 * Every status change on an attached, non-deleted track enqueues a notification
 * (§4.2). New (unclaimed) tracks never notify, and an ownership change never
 * notifies at all (§7.3) — a day-0 import that attaches 500 historical parcels
 * must not blast 500 "your parcel is ready" messages.
 */
export async function applyImport(
  tenantId: string,
  status: TrackStatus,
  codes: ImportRow[],
  createdBy: string,
  batchId: string | null = null,
  source: ImportRunSource = { sourceName: null, rejected: [] },
): Promise<ImportResult> {
  const db = getDb();
  const result: ImportResult = {
    // Filled by the run row created inside the transaction below; an import
    // with nothing to write never gets one (the action refuses it first).
    runId: '',
    created: 0,
    updated: 0,
    queued: 0,
    assigned: 0,
    enriched: 0,
  };
  if (codes.length === 0) return result;

  // §7.18: what this run wrote and what stood there before, per touched track.
  const items: ImportRunItem[] = [];

  // Only load tariff/currency when a row actually carries kg or a price.
  const needsPricing = codes.some(
    (c) => c.weightGrams != null || c.priceTiyin != null,
  );
  const pricing: ImportPricingContext = needsPricing
    ? await getImportPricingContext(tenantId)
    : { currency: 'UZS', usdRateTiyin: null, tariff: null };

  // Enqueued only AFTER the transaction commits: pg-boss writes through its own
  // connection, so a job sent mid-transaction would survive a rollback and
  // notify about rows that were never written.
  const toNotify: Array<{ trackId: string; customerId: string }> = [];

  // All writes in one transaction — an import either fully applies or not at all.
  await db.transaction(async (tx) => {
    // §7.18: the run row is written INSIDE the transaction, before the events
    // that reference it. A rolled-back import must not leave a run claiming it
    // happened, and every event this run appends carries its id.
    const [run] = await tx
      .insert(importRuns)
      .values({
        tenantId,
        createdBy,
        status,
        batchId,
        sourceName: source.sourceName,
        rejected: source.rejected.slice(0, MAX_REJECTED_ROWS),
        rejectedCount: source.rejected.length,
      })
      .returning({ id: importRuns.id });
    const runId = run!.id;
    result.runId = runId;

    // Preload existing rows for this batch in one query per chunk.
    const existingRows: Array<{
      id: string;
      codeNormalized: string;
      currentStatus: TrackStatus;
      customerId: string | null;
      deletedAt: Date | null;
      batchId: string | null;
      weightGrams: number | null;
      priceTiyin: number | null;
      priceUsdCents: number | null;
      usdRateUsed: number | null;
      tariffId: string | null;
      priceManual: boolean;
      marka: string | null;
      description: string | null;
      volumetricGrams: number | null;
      lengthCm: number | null;
      widthCm: number | null;
      heightCm: number | null;
    }> = [];
    for (const chunk of chunked(
      codes.map((c) => c.normalized),
      BULK_CHUNK,
    )) {
      const rows = await tx
        .select({
          id: tracks.id,
          codeNormalized: tracks.codeNormalized,
          currentStatus: tracks.currentStatus,
          customerId: tracks.customerId,
          deletedAt: tracks.deletedAt,
          // §7.18: the undo restores what stood here, so the run has to read
          // it — `batch_id` and `deleted_at` are overwrites, not fills.
          batchId: tracks.batchId,
          weightGrams: tracks.weightGrams,
          priceTiyin: tracks.priceTiyin,
          priceUsdCents: tracks.priceUsdCents,
          usdRateUsed: tracks.usdRateUsed,
          tariffId: tracks.tariffId,
          priceManual: tracks.priceManual,
          marka: tracks.marka,
          description: tracks.description,
          volumetricGrams: tracks.volumetricGrams,
          // §7.16: a parcel measured at the warehouse keeps its volumetric
          // price when a weight arrives by file afterwards.
          lengthCm: tracks.lengthCm,
          widthCm: tracks.widthCm,
          heightCm: tracks.heightCm,
        })
        .from(tracks)
        .where(
          and(
            eq(tracks.tenantId, tenantId),
            inArray(tracks.codeNormalized, chunk),
          ),
        );
      existingRows.push(...rows);
    }
    const existingByCode = new Map(
      existingRows.map((r) => [r.codeNormalized, r]),
    );

    // New codes → bulk insert. ON CONFLICT DO NOTHING absorbs a concurrent
    // import racing on the same (tenant, code): the loser's row silently skips
    // (not created, not updated this run) instead of aborting the whole import.
    const newCodes = codes.filter((c) => !existingByCode.has(c.normalized));
    for (const chunk of chunked(newCodes, BULK_CHUNK)) {
      // Each row is planned once and used twice — for the INSERT and for the
      // run's undo evidence — so the two can never describe different writes.
      const planned = new Map<string, ImportRunValues>();
      const inserted = await tx
        .insert(tracks)
        .values(
          chunk.map((code) => {
            const price = planImportPricing(
              {
                weightGrams: code.weightGrams ?? null,
                priceTiyin: code.priceTiyin ?? null,
              },
              pricing,
            );
            const row = {
              tenantId,
              codeNormalized: code.normalized,
              codeOriginal: code.original,
              currentStatus: status,
              batchId,
              customerId: code.customerId ?? null,
              weightGrams: price?.weightGrams ?? null,
              priceTiyin: price?.priceTiyin ?? null,
              priceUsdCents: price?.priceUsdCents ?? null,
              usdRateUsed: price?.usdRateUsed ?? null,
              tariffId: price?.tariffId ?? null,
              priceManual: price?.priceManual ?? false,
              marka: code.marka ?? null,
              description: code.description ?? null,
            };
            // Everything the created row carries, `deleted_at` included: a
            // parcel claimed, weighed or deleted after the import is one the
            // undo must leave alone (§7.18).
            const { tenantId: _t, codeNormalized: _c, codeOriginal: _o, ...written } = row;
            planned.set(code.normalized, { ...written, deletedAt: null });
            return row;
          }),
        )
        .onConflictDoNothing({
          target: [tracks.tenantId, tracks.codeNormalized],
        })
        .returning({ id: tracks.id, codeNormalized: tracks.codeNormalized });

      if (inserted.length > 0) {
        const byCode = new Map(chunk.map((c) => [c.normalized, c]));
        await tx.insert(trackEvents).values(
          inserted.map((t) => {
            const row = byCode.get(t.codeNormalized);
            return {
              trackId: t.id,
              status,
              // One event for a created track: the import that created it. The
              // owner/kg it arrived with are part of that same act, so they ride
              // in `meta` instead of becoming separate audit rows.
              meta: {
                source: 'import',
                // §7.18: per-track provenance lives in the audit log, so no
                // column on `tracks` had to be added to trace a run.
                runId,
                ...(row?.customerId ? { customerId: row.customerId } : {}),
                ...(row?.weightGrams != null
                  ? { weightGrams: row.weightGrams }
                  : {}),
                ...(row?.priceTiyin != null
                  ? { priceTiyin: row.priceTiyin }
                  : {}),
              },
              createdBy,
            };
          }),
        );
        for (const t of inserted) {
          const row = byCode.get(t.codeNormalized);
          if (row?.customerId) result.assigned++;
          if (row?.weightGrams != null || row?.priceTiyin != null) {
            result.enriched++;
          }
          items.push({
            trackId: t.id,
            action: 'created',
            wrote: planned.get(t.codeNormalized) ?? {},
            prior: {},
          });
        }
      }
      result.created += inserted.length;
      // A created track never notifies — not even one the file attached to an
      // owner. §7.3: attaching is not a status change, and a day-0 import of
      // historical parcels would otherwise message every customer at once.
    }

    // Existing codes → plan each row, then group ids by identical SET so every
    // group is one bulk UPDATE instead of a per-row round trip. Per-row values
    // (owner, kg, price) cannot share a SET, so they go through one
    // `UPDATE … FROM (VALUES …)` per chunk instead.
    const writeIds: string[] = []; // status change and/or revive
    const batchOnlyIds: string[] = []; // §7.2 batch attach on a §2 no-op row
    const eventIds: string[] = [];
    const enrich: EnrichWrite[] = [];
    const assignEvents: Array<{
      trackId: string;
      status: TrackStatus;
      meta: AssignEventMeta;
    }> = [];

    for (const code of codes) {
      const existing = existingByCode.get(code.normalized);
      if (!existing) continue;

      const plan = planStatusChange({
        previousStatus: existing.currentStatus,
        newStatus: status,
        customerId: existing.customerId,
        wasDeleted: existing.deletedAt != null,
      });

      // §7.18 undo evidence: filled in beside every write below, so a column
      // can never be written without recording what stood there.
      const wrote: ImportRunValues = {};
      const prior: ImportRunValues = {};

      // --- Fill-empty enrichment (§5.4 mapping) ---------------------------
      // Never reassign from a file: an owner already on the track wins, so the
      // only ownership move an import can make is `attach`.
      const fillCustomerId =
        existing.customerId == null ? (code.customerId ?? null) : null;

      const fillWeight =
        existing.weightGrams == null ? (code.weightGrams ?? null) : null;
      let fillPrice: number | null = null;
      let fillUsdCents: number | null = null;
      let fillRate: number | null = null;
      let fillTariffId: string | null = null;
      let fillManual: boolean | null = null;
      let fillVolumetric: number | null = null;

      if (existing.priceTiyin == null) {
        if (code.priceTiyin != null) {
          // An agreed price from the file is a manual price (§7.4).
          fillPrice = code.priceTiyin;
          fillManual = true;
          if (
            existing.tariffId == null &&
            (fillWeight ?? existing.weightGrams) != null
          ) {
            fillTariffId = pricing.tariff?.id ?? null;
          }
        } else if (fillWeight != null) {
          const price = planImportPricing(
            {
              weightGrams: fillWeight,
              priceTiyin: null,
              dimensions: readDimensions(
                existing.lengthCm,
                existing.widthCm,
                existing.heightCm,
              ),
            },
            pricing,
          );
          if (price) {
            fillPrice = price.priceTiyin;
            fillUsdCents = price.priceUsdCents;
            fillRate = price.usdRateUsed;
            fillVolumetric = price.volumetricGrams;
            if (existing.tariffId == null) fillTariffId = price.tariffId;
          }
        }
      }

      // §7.13 fill-if-empty: a re-imported file must not clobber what an admin
      // typed by hand, so metadata only lands where the column is still NULL.
      const fillMarka = existing.marka == null ? (code.marka ?? null) : null;
      const fillDescription =
        existing.description == null ? (code.description ?? null) : null;

      const hasEnrichment =
        fillCustomerId != null ||
        fillWeight != null ||
        fillPrice != null ||
        fillMarka != null ||
        fillDescription != null;
      if (hasEnrichment) {
        enrich.push({
          id: existing.id,
          customerId: fillCustomerId,
          weightGrams: fillWeight,
          priceTiyin: fillPrice,
          priceUsdCents: fillUsdCents,
          usdRateUsed: fillRate,
          tariffId: fillTariffId,
          priceManual: fillManual,
          marka: fillMarka,
          description: fillDescription,
          volumetricGrams: fillVolumetric,
        });
        // A null here means "leave alone" (the COALESCE below), so only the
        // non-null ones are writes the undo can take back.
        const fills: Array<
          [ImportRunField, ImportRunValues[ImportRunField], ImportRunValues[ImportRunField]]
        > = [
          ['customerId', fillCustomerId, existing.customerId],
          ['weightGrams', fillWeight, existing.weightGrams],
          ['priceTiyin', fillPrice, existing.priceTiyin],
          ['priceUsdCents', fillUsdCents, existing.priceUsdCents],
          ['usdRateUsed', fillRate, existing.usdRateUsed],
          ['tariffId', fillTariffId, existing.tariffId],
          ['priceManual', fillManual, existing.priceManual],
          ['marka', fillMarka, existing.marka],
          ['description', fillDescription, existing.description],
          ['volumetricGrams', fillVolumetric, existing.volumetricGrams],
        ];
        for (const [key, value, before] of fills) {
          if (value == null) continue;
          wrote[key] = value;
          prior[key] = before;
        }
        if (fillCustomerId != null) {
          result.assigned++;
          // §7.3: an ownership change is its own audit row, carrying the
          // track's status (the column is NOT NULL) — `meta.action` is what
          // marks it as an assignment rather than a status move. The meta comes
          // from the shared planner so the panel's and the import's assignment
          // rows can never drift apart.
          const assign = planAssignCustomer({
            currentCustomerId: null,
            newCustomerId: fillCustomerId,
          });
          assignEvents.push({
            trackId: existing.id,
            status: plan.willWrite ? status : existing.currentStatus,
            meta: assign.eventMeta!,
          });
        }
        if (fillWeight != null || fillPrice != null) result.enriched++;
      }

      if (plan.willWrite) {
        if (existing.currentStatus !== status) {
          wrote.currentStatus = status;
          prior.currentStatus = existing.currentStatus;
        }
        if (existing.deletedAt != null) {
          // §7.2 revives a soft-deleted row on import — a write like any other,
          // and one the undo puts back (§7.18).
          wrote.deletedAt = null;
          prior.deletedAt = existing.deletedAt.toISOString();
        }
      }
      if (batchId != null && existing.batchId !== batchId) {
        wrote.batchId = batchId;
        prior.batchId = existing.batchId;
      }
      if (Object.keys(wrote).length > 0) {
        items.push({ trackId: existing.id, action: 'updated', wrote, prior });
      }

      // §7.2: a selected batch attaches to ALL rows, even ones whose status is
      // a §2 no-op. Skip only when there is nothing at all to write.
      if (plan.willWrite) writeIds.push(existing.id);
      else if (batchId != null) batchOnlyIds.push(existing.id);
      else if (!hasEnrichment) continue;

      // §2: only a real status change appends a status event.
      if (plan.willEvent) eventIds.push(existing.id);
      result.updated += 1;

      if (plan.willNotify) {
        toNotify.push({
          trackId: existing.id,
          customerId: existing.customerId!,
        });
      }
    }

    const writeSet: Partial<typeof tracks.$inferInsert> = {
      currentStatus: status,
      deletedAt: null,
    };
    if (batchId != null) writeSet.batchId = batchId;
    for (const chunk of chunked(writeIds, BULK_CHUNK)) {
      await tx.update(tracks).set(writeSet).where(inArray(tracks.id, chunk));
    }
    for (const chunk of chunked(batchOnlyIds, BULK_CHUNK)) {
      await tx.update(tracks).set({ batchId }).where(inArray(tracks.id, chunk));
    }

    // Per-row fills in one statement per chunk. `COALESCE(v.x, t.x)` is the
    // fill-empty rule in SQL: a NULL in the VALUES list means "leave alone",
    // and the planning above already refused to produce a value for a column
    // that was occupied.
    for (const chunk of chunked(enrich, BULK_CHUNK)) {
      const values = sql.join(
        chunk.map(
          (r) =>
            sql`(${r.id}::uuid, ${r.customerId}::uuid, ${r.weightGrams}::integer, ${r.priceTiyin}::bigint, ${r.priceUsdCents}::bigint, ${r.usdRateUsed}::bigint, ${r.tariffId}::uuid, ${r.priceManual}::boolean, ${r.marka}::text, ${r.description}::text, ${r.volumetricGrams}::integer)`,
        ),
        sql`, `,
      );
      await tx.execute(sql`
        UPDATE ${tracks} AS t SET
          customer_id = COALESCE(v.customer_id, t.customer_id),
          weight_grams = COALESCE(v.weight_grams, t.weight_grams),
          price_tiyin = COALESCE(v.price_tiyin, t.price_tiyin),
          price_usd_cents = COALESCE(v.price_usd_cents, t.price_usd_cents),
          usd_rate_used = COALESCE(v.usd_rate_used, t.usd_rate_used),
          tariff_id = COALESCE(v.tariff_id, t.tariff_id),
          price_manual = COALESCE(v.price_manual, t.price_manual),
          marka = COALESCE(v.marka, t.marka),
          description = COALESCE(v.description, t.description),
          volumetric_grams = COALESCE(v.volumetric_grams, t.volumetric_grams)
        FROM (VALUES ${values}) AS v(id, customer_id, weight_grams, price_tiyin,
          price_usd_cents, usd_rate_used, tariff_id, price_manual, marka,
          description, volumetric_grams)
        WHERE t.id = v.id AND t.tenant_id = ${tenantId}::uuid
      `);
    }

    for (const chunk of chunked(eventIds, BULK_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((trackId) => ({
          trackId,
          status,
          meta: { source: 'import', runId },
          createdBy,
        })),
      );
    }
    for (const chunk of chunked(assignEvents, BULK_CHUNK)) {
      await tx.insert(trackEvents).values(
        chunk.map((e) => ({
          trackId: e.trackId,
          status: e.status,
          meta: { ...e.meta, source: 'import', runId },
          createdBy,
        })),
      );
    }

    // Close the run with what it actually did (§7.18). `queued_count` is known
    // here even though the jobs are sent after the commit — the undo reports
    // how many notifications this import set in motion, not how many landed.
    await tx
      .update(importRuns)
      .set({
        createdCount: result.created,
        updatedCount: result.updated,
        assignedCount: result.assigned,
        enrichedCount: result.enriched,
        queuedCount: toNotify.length,
        items,
      })
      .where(eq(importRuns.id, runId));
  });

  // §7.18: held for a minute, and carrying the run so the worker can drop a
  // delivery whose import was taken back inside that minute.
  await enqueueNotifications(
    toNotify.map((n) => ({
      tenantId,
      trackId: n.trackId,
      customerId: n.customerId,
      status,
      importRunId: result.runId,
    })),
    { holdSeconds: IMPORT_NOTIFY_HOLD_SECONDS },
  );
  result.queued = toNotify.length;

  return result;
}
