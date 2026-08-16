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
import { columnLetter } from './importMapping';
import type { ImportRejectReason, ImportRejectedRow } from './importRun';

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

/** The exports the panel offers, keyed for {@link EXPORT_FILE_BASE}. */
export type ExportKind =
  | 'tracks'
  | 'customers'
  | 'debtors'
  | 'payments'
  /** Rows an import could not use, handed back for fixing (§7.18, M3). */
  | 'rejected';

/**
 * Download-name stem per locale. Transliterated on purpose — `exportFileName`
 * requires ASCII, so the Russian names are romanised rather than Cyrillic; the
 * sheet inside is fully localised via {@link EXPORT_LABELS}.
 */
export const EXPORT_FILE_BASE: Record<Lang, Record<ExportKind, string>> = {
  uz: {
    tracks: 'treklar',
    customers: 'mijozlar',
    debtors: 'qarzdorlar',
    payments: 'tolovlar',
    rejected: 'muammoli-qatorlar',
  },
  ru: {
    tracks: 'treki',
    customers: 'klienty',
    debtors: 'dolzhniki',
    payments: 'platezhi',
    rejected: 'problemnye-stroki',
  },
};

// --- Labels (uz default, ru secondary — CLAUDE.md rule 5) -------------------

interface ExportLabels {
  sheet: {
    tracks: string;
    customers: string;
    payments: string;
    rejected: string;
  };
  tracks: string[];
  customers: string[];
  payments: string[];
  /** §7.18/M3: `Qator` + `Sabab` + `Qiymat`, then the source columns. */
  rejected: string[];
  /** Why each row is in that file — the column that makes it actionable. */
  rejectReason: Record<ImportRejectReason, string>;
  /** Source column header, numbered as the spreadsheet numbers them. */
  sourceColumn(letter: string): string;
  yes: string;
  no: string;
  truncated(total: number, exported: number): string;
  /** The run stored only the first N problem rows (§7.18 cap). */
  rejectedTruncated(total: number, exported: number): string;
}

/**
 * Column headers in both languages. The admin panel is Uzbek-only today
 * (AUDIT.md T17 moves the rest of it), but a spreadsheet leaves the building —
 * an owner forwards it to an accountant — so both catalogues exist from the
 * start and the caller picks.
 */
export const EXPORT_LABELS: Record<Lang, ExportLabels> = {
  uz: {
    sheet: {
      tracks: 'Treklar',
      customers: 'Mijozlar',
      payments: "To'lovlar",
      rejected: 'Muammoli qatorlar',
    },
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
      'Qabul qildi',
      'Izoh',
    ],
    rejected: ['Qator', 'Sabab', 'Qiymat'],
    rejectReason: {
      badCode: "Trek kodi yaroqsiz — qator import qilinmadi",
      weight: "Vazn o'qilmadi — trek vaznsiz kiritildi",
      price: "Narx o'qilmadi — trek narxsiz kiritildi",
      customerMissing: 'Mijoz topilmadi — trek biriktirilmadi',
      customerAmbiguous:
        "Bir nechta mijozga to'g'ri keldi — trek biriktirilmadi",
    },
    sourceColumn: (letter) => `Ustun ${letter}`,
    yes: 'Ha',
    no: "Yo'q",
    truncated: (total, exported) =>
      `⚠️ Juda ko'p qator: ${total} tadan faqat birinchi ${exported} tasi eksport qilindi. Filtrni torroq qiling.`,
    rejectedTruncated: (total, exported) =>
      `⚠️ ${total} ta muammoli qatordan faqat birinchi ${exported} tasi saqlangan.`,
  },
  ru: {
    sheet: {
      tracks: 'Треки',
      customers: 'Клиенты',
      payments: 'Платежи',
      rejected: 'Проблемные строки',
    },
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
      'Принял',
      'Примечание',
    ],
    rejected: ['Строка', 'Причина', 'Значение'],
    rejectReason: {
      badCode: 'Некорректный трек-код — строка не импортирована',
      weight: 'Вес не распознан — трек добавлен без веса',
      price: 'Цена не распознана — трек добавлен без цены',
      customerMissing: 'Клиент не найден — трек не привязан',
      customerAmbiguous:
        'Совпало несколько клиентов — трек не привязан',
    },
    sourceColumn: (letter) => `Столбец ${letter}`,
    yes: 'Да',
    no: 'Нет',
    truncated: (total, exported) =>
      `⚠️ Слишком много строк: из ${total} экспортированы только первые ${exported}. Сузьте фильтр.`,
    rejectedTruncated: (total, exported) =>
      `⚠️ Из ${total} проблемных строк сохранены только первые ${exported}.`,
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
  /** Employee who took the money (AUDIT.md T8); null for pre-T8 rows. */
  authorName: string | null;
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
      // An owner forwards this file to an accountant (§5.11); without the
      // cashier's name the statement cannot be reconciled against a shift.
      r.authorName,
      r.note,
    ]),
  };
}

// --- Rejected import rows (SPEC §7.18, tasks.md M3) -------------------------

/**
 * The rows an import could not use, handed back as a file the office can fix
 * and re-send.
 *
 * Two things make it worth more than the on-screen list it replaces: the
 * ORIGINAL cells travel with each row (a line number alone is not something
 * anyone can act on in Guangzhou), and every row names its reason — including
 * the ones that were imported anyway, with a weight or an owner missing. A
 * warning is not an error, but it is still work somebody has to redo.
 */
export function buildRejectedSheet(
  rows: readonly ImportRejectedRow[],
  opts: { lang?: Lang; notice?: string } = {},
): ExportSheet {
  const lang = opts.lang ?? 'uz';
  const L = EXPORT_LABELS[lang];
  // As wide as the widest problem row — the file gives back what it was given.
  const width = rows.reduce((max, r) => Math.max(max, r.cells.length), 0);

  return {
    name: L.sheet.rejected,
    header: [
      ...L.rejected,
      ...Array.from({ length: width }, (_, i) => L.sourceColumn(columnLetter(i))),
    ],
    notice: opts.notice,
    rows: rows.map((r) => [
      r.line,
      L.rejectReason[r.reason],
      r.value,
      ...Array.from({ length: width }, (_, i) => r.cells[i] ?? null),
    ]),
  };
}
