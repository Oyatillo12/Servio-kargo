/**
 * Excel export sheet builders (AUDIT.md T2).
 *
 * Pure row-shaping: the apps hand in already tenant-scoped plain rows and get
 * back a header + cell matrix; turning that into an .xlsx file is the web app's
 * job (`apps/web/lib/xlsx.ts`). Keeping the shaping here means the column set,
 * the labels and the money/weight/date conventions are testable without a
 * database or a spreadsheet library.
 *
 * Two conventions matter and are deliberate:
 *
 * 1. **Money and weight are written as NUMBERS, not formatted strings.** The
 *    whole point of the export is that the owner can open it and work — sum a
 *    debt column, sort by price, pivot by month. `formatSom` produces
 *    `"1 250 000"`, which Excel stores as text: `SUM()` over it returns 0. So
 *    money is exported as whole **so'm** (the same rounding `formatSom` shows,
 *    CLAUDE.md rule 6 keeps tiyin only in storage) and weight as **kg**, both
 *    with the unit named in the column header.
 * 2. **Dates are written as `DD.MM.YYYY HH:mm` text in Asia/Tashkent** (§7.9).
 *    A real Excel date serial carries no timezone, so the same cell would read
 *    differently for a viewer whose machine is not on Tashkent time.
 */

import { formatDateTime } from '../format';
import type { Lang } from '../i18n';
import { t } from '../i18n';
import { STATUS_META, type TrackStatus } from '../status';
import { tashkentDateKey } from './dashboard';

/** A single spreadsheet cell. `null` renders as an empty cell. */
export type ExportCell = string | number | null;

export interface ExportSheet {
  /** Excel tab name. Excel caps these at 31 chars and rejects `[]:*?/\`. */
  name: string;
  header: string[];
  rows: ExportCell[][];
  /**
   * Optional trailing note placed in the first column (e.g. a row-cap warning).
   * Never silently truncate an export — the owner must see that it is partial.
   */
  notice?: string;
}

/**
 * Hard row cap per sheet. Exporting a tenant's whole history buffers every row
 * in Node memory before the file is written, so this bounds a single request;
 * beyond it the export carries {@link truncationNotice} and the admin narrows
 * the filter. Well above the ~80k-track scale measured in T4.
 */
export const EXPORT_MAX_ROWS = 50_000;

// --- Value conversion -------------------------------------------------------

/** Integer tiyin → whole so'm as a number (same rounding as `formatSom`). */
export function somFromTiyin(tiyin: number): number;
export function somFromTiyin(tiyin: number | null): number | null;
export function somFromTiyin(tiyin: number | null): number | null {
  return tiyin == null ? null : Math.round(tiyin / 100);
}

/** Integer grams → kg as a number with at most 2 decimals (as `formatKg`). */
export function kgFromGrams(grams: number | null): number | null {
  return grams == null ? null : Math.round(grams / 10) / 100;
}

/**
 * The warning appended to a capped sheet. `total` is the number of rows that
 * matched the filter, `exported` how many made it into the file.
 */
export function truncationNotice(
  total: number,
  exported: number,
  lang: Lang = 'uz',
): string | undefined {
  if (total <= exported) return undefined;
  return EXPORT_LABELS[lang].truncated(total, exported);
}

/**
 * Download file name, e.g. `treklar-2026-07-26.xlsx`. The date is the Tashkent
 * calendar day (§7.9) so two exports taken the same working evening can't land
 * on different names. `base` stays ASCII: a non-ASCII `filename=` in
 * Content-Disposition is mangled by some Windows browsers.
 */
export function exportFileName(base: string, at: Date): string {
  return `${base}-${tashkentDateKey(at)}.xlsx`;
}

// --- Labels (uz default, ru secondary — CLAUDE.md rule 5) -------------------

interface ExportLabels {
  sheet: { tracks: string; customers: string; payments: string };
  tracks: string[];
  customers: string[];
  payments: string[];
  yes: string;
  no: string;
  truncated(total: number, exported: number): string;
}

/**
 * Column headers in both languages. The admin panel is Uzbek-only today
 * (AUDIT.md T17 moves the rest of it), but a spreadsheet leaves the building —
 * an owner forwards it to an accountant — so both catalogues exist from the
 * start and the caller picks.
 */
export const EXPORT_LABELS: Record<Lang, ExportLabels> = {
  uz: {
    sheet: { tracks: 'Treklar', customers: 'Mijozlar', payments: "To'lovlar" },
    tracks: [
      'Trek kodi',
      'Holat',
      'Mijoz kodi',
      'Mijoz',
      'Telefon',
      'Reys',
      "Og'irlik (kg)",
      "Narx (so'm)",
      'Yaratilgan',
    ],
    customers: [
      'Mijoz kodi',
      'Ism',
      'Telefon',
      'Til',
      'Telegram',
      'Treklar',
      "Qarz (so'm)",
      "Ro'yxatdan o'tgan",
    ],
    payments: [
      'Sana',
      'Mijoz kodi',
      'Mijoz',
      'Telefon',
      'Usul',
      "Summa (so'm)",
      'Izoh',
    ],
    yes: 'Ha',
    no: "Yo'q",
    truncated: (total, exported) =>
      `⚠️ Juda ko'p qator: ${total} tadan faqat birinchi ${exported} tasi eksport qilindi. Filtrni torroq qiling.`,
  },
  ru: {
    sheet: { tracks: 'Треки', customers: 'Клиенты', payments: 'Платежи' },
    tracks: [
      'Трек-код',
      'Статус',
      'Код клиента',
      'Клиент',
      'Телефон',
      'Рейс',
      'Вес (кг)',
      'Цена (сум)',
      'Создан',
    ],
    customers: [
      'Код клиента',
      'Имя',
      'Телефон',
      'Язык',
      'Telegram',
      'Треки',
      'Долг (сум)',
      'Зарегистрирован',
    ],
    payments: [
      'Дата',
      'Код клиента',
      'Клиент',
      'Телефон',
      'Способ',
      'Сумма (сум)',
      'Примечание',
    ],
    yes: 'Да',
    no: 'Нет',
    truncated: (total, exported) =>
      `⚠️ Слишком много строк: из ${total} экспортированы только первые ${exported}. Сузьте фильтр.`,
  },
};

// --- Tracks (SPEC §5.2 columns) ---------------------------------------------

export interface TrackExportRow {
  codeOriginal: string;
  currentStatus: TrackStatus;
  clientCode: string | null;
  customerName: string | null;
  customerPhone: string | null;
  batchName: string | null;
  weightGrams: number | null;
  priceTiyin: number | null;
  createdAt: Date;
}

/**
 * Tracks sheet. Soft-deleted rows must be excluded by the caller's query
 * (§7.8) — an export is a snapshot of what the panel shows, not of the table.
 */
export function buildTracksSheet(
  rows: readonly TrackExportRow[],
  opts: { lang?: Lang; notice?: string } = {},
): ExportSheet {
  const lang = opts.lang ?? 'uz';
  const L = EXPORT_LABELS[lang];
  return {
    name: L.sheet.tracks,
    header: L.tracks,
    notice: opts.notice,
    rows: rows.map((r) => [
      r.codeOriginal,
      STATUS_META[r.currentStatus][lang],
      r.clientCode,
      r.customerName,
      r.customerPhone,
      r.batchName,
      kgFromGrams(r.weightGrams),
      somFromTiyin(r.priceTiyin),
      formatDateTime(r.createdAt),
    ]),
  };
}

// --- Customers (SPEC §5.5, debt per §7.5) -----------------------------------

export interface CustomerExportRow {
  clientCode: string;
  fullName: string | null;
  phone: string | null;
  lang: Lang;
  hasTelegram: boolean;
  trackCount: number;
  /** Net debt in tiyin; negative means the customer is in advance (§7.5). */
  debtTiyin: number;
  createdAt: Date;
}

/**
 * Customers sheet. Debt keeps its sign: a negative figure is an advance, and
 * flattening it to zero would break the column's SUM against the books.
 */
export function buildCustomersSheet(
  rows: readonly CustomerExportRow[],
  opts: { lang?: Lang; notice?: string } = {},
): ExportSheet {
  const lang = opts.lang ?? 'uz';
  const L = EXPORT_LABELS[lang];
  return {
    name: L.sheet.customers,
    header: L.customers,
    notice: opts.notice,
    rows: rows.map((r) => [
      r.clientCode,
      r.fullName,
      r.phone,
      r.lang,
      r.hasTelegram ? L.yes : L.no,
      r.trackCount,
      somFromTiyin(r.debtTiyin),
      formatDateTime(r.createdAt),
    ]),
  };
}

// --- Payments (SPEC §5.5) ---------------------------------------------------

export interface PaymentExportRow {
  createdAt: Date;
  clientCode: string;
  customerName: string | null;
  customerPhone: string | null;
  method: 'cash' | 'click' | 'payme' | 'other';
  amountTiyin: number;
  note: string | null;
}

/** Payments sheet; method labels reuse the canonical i18n catalogue (§3.4). */
export function buildPaymentsSheet(
  rows: readonly PaymentExportRow[],
  opts: { lang?: Lang; notice?: string } = {},
): ExportSheet {
  const lang = opts.lang ?? 'uz';
  const L = EXPORT_LABELS[lang];
  const method = t(lang).paymentMethod;
  return {
    name: L.sheet.payments,
    header: L.payments,
    notice: opts.notice,
    rows: rows.map((r) => [
      formatDateTime(r.createdAt),
      r.clientCode,
      r.customerName,
      r.customerPhone,
      method[r.method],
      somFromTiyin(r.amountTiyin),
      r.note,
    ]),
  };
}
