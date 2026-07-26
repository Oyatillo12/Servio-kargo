/**
 * Excel export queries (AUDIT.md T2). Each one reuses the exact filter of the
 * screen its button sits on, so the file can never disagree with the list.
 */

import 'server-only';

import { and, count, desc, eq } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { batches, customers, payments, tracks } from '@kargotrack/db/schema';
import {
  EXPORT_MAX_ROWS,
  type CustomerExportRow,
  type PaymentExportRow,
  type TrackExportRow,
} from '@kargotrack/shared';

import { listCustomersWithDebt } from './customers';
import { tracksFilter, type TrackFilter } from './track-filter';

/** What an export query returns: the capped rows plus how many matched. */
export interface ExportQueryResult<T> {
  rows: T[];
  /** Rows matching the filter, before {@link EXPORT_MAX_ROWS} is applied. */
  total: number;
}

/**
 * Every track matching the current screen's filter, newest first, for the Excel
 * export. Same tenant scope and same WHERE as {@link listTracks} — only the
 * pagination differs. Capped at {@link EXPORT_MAX_ROWS}; the caller reports the
 * shortfall from `total` rather than truncating silently.
 */
export async function listTracksForExport(
  args: TrackFilter,
): Promise<ExportQueryResult<TrackExportRow>> {
  const db = getDb();
  const where = tracksFilter(args);

  const [totalRow] = await db
    .select({ value: count() })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .where(where);

  const rows = await db
    .select({
      codeOriginal: tracks.codeOriginal,
      currentStatus: tracks.currentStatus,
      clientCode: customers.clientCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      batchName: batches.name,
      weightGrams: tracks.weightGrams,
      priceTiyin: tracks.priceTiyin,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .leftJoin(customers, eq(tracks.customerId, customers.id))
    .leftJoin(batches, eq(tracks.batchId, batches.id))
    .where(where)
    .orderBy(desc(tracks.createdAt))
    .limit(EXPORT_MAX_ROWS);

  return { rows, total: totalRow?.value ?? 0 };
}

/**
 * Customers with debt for the Excel export. `onlyDebtors` mirrors the /debtors
 * screen (net debt > 0, largest first, SPEC §5.6); otherwise the /customers
 * order (client code) is kept.
 */
export async function listCustomersForExport(
  tenantId: string,
  opts: { q?: string; onlyDebtors?: boolean } = {},
): Promise<ExportQueryResult<CustomerExportRow>> {
  const all = await listCustomersWithDebt(tenantId, opts.q);
  const matching = opts.onlyDebtors
    ? all.filter((c) => c.debtTiyin > 0).sort((a, b) => b.debtTiyin - a.debtTiyin)
    : all;

  return {
    total: matching.length,
    rows: matching.slice(0, EXPORT_MAX_ROWS).map((c) => ({
      clientCode: c.clientCode,
      fullName: c.fullName,
      phone: c.phone,
      lang: c.lang,
      hasTelegram: c.hasTelegram,
      trackCount: c.trackCount,
      debtTiyin: c.debtTiyin,
      createdAt: c.createdAt,
    })),
  };
}

/**
 * Payments for the Excel export, newest first. `customerId` narrows it to one
 * customer's statement (the customer-detail button); membership in the tenant
 * is enforced by the tenant_id predicate, so an id from another tenant simply
 * matches nothing.
 */
export async function listPaymentsForExport(
  tenantId: string,
  opts: { customerId?: string } = {},
): Promise<ExportQueryResult<PaymentExportRow>> {
  const db = getDb();
  const conds = [eq(payments.tenantId, tenantId)];
  if (opts.customerId) conds.push(eq(payments.customerId, opts.customerId));
  const where = and(...conds);

  const [totalRow] = await db
    .select({ value: count() })
    .from(payments)
    .where(where);

  const rows = await db
    .select({
      createdAt: payments.createdAt,
      clientCode: customers.clientCode,
      customerName: customers.fullName,
      customerPhone: customers.phone,
      method: payments.method,
      amountTiyin: payments.amountTiyin,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(customers, eq(payments.customerId, customers.id))
    .where(where)
    .orderBy(desc(payments.createdAt))
    .limit(EXPORT_MAX_ROWS);

  return { rows, total: totalRow?.value ?? 0 };
}
