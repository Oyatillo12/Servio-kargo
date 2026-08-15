/**
 * Column-mapped import (SPEC §5.4, §7.1, §7.2, §7.4, §7.12).
 *
 * The original importer read a spreadsheet as one flat bag of cells and kept
 * whatever looked like a track code. Real cargo Excels are tables: a code
 * column, an owner column, kg and an agreed price. This module turns such a
 * grid into structured rows.
 *
 * Everything here is PURE: it classifies text, it never touches the database.
 * Resolving an owner reference to a `customers.id`, loading tariffs and writing
 * rows all stay in the web layer (`lib/queries/*`), which is the only place that
 * may scope by tenant (CLAUDE.md rule 1).
 *
 * Money is integer tiyin and weight is integer grams — never floats
 * (CLAUDE.md rule 6).
 */

import { isValidTrackCode, normalizeCode } from '../normalize';
import { normalizePhone } from '../phone';
import { computeTrackPrice, type Currency } from './price';
import { chargeableWeight, type Dimensions } from './volumetric';

/** Fields an admin can map a spreadsheet column onto. `code` is mandatory. */
export const IMPORT_FIELDS = [
  'code',
  'customer',
  'weight',
  'price',
  'description',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Column index per field; `null` means "this file has no such column". */
export interface ColumnMapping {
  code: number;
  customer: number | null;
  weight: number | null;
  price: number | null;
  /** Goods description → `tracks.description` (§7.13), fill-if-empty. */
  description: number | null;
}

/** Grid limits — an import is one flight, not a data warehouse. */
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_COLUMNS = 12;
/** Longest cell text kept; anything longer is a paragraph, not a field. */
export const MAX_CELL_LENGTH = 120;

/** Reject absurd weights — over 100 t is a typo, not cargo (mirrors `calc.ts`). */
const MAX_GRAMS = 100_000 * 1000;
/** Reject absurd prices: 10 billion so'm in tiyin. */
const MAX_PRICE_TIYIN = 10_000_000_000 * 100;

// --- Cell parsers ----------------------------------------------------------

/**
 * Separators admins and Excel put inside a number: whitespace of every kind
 * (including the non-breaking spaces Excel emits), apostrophes, underscores.
 */
const SOFT_SPACE = /[\s\u00a0\u202f'’`_]/g;

const KG_SUFFIX = /(kilogramm?|kilo|kg|кг)\.?$/i;
const GRAM_SUFFIX = /(gramm?|gr|g|гр|г)\.?$/i;
/** Currency noise around a price. `$`/`usd` are handled separately (rejected). */
const SOM_NOISE = /(so['’`]?m|sum|сум|сўм|uzs|som)\.?/gi;
const USD_MARK = /[$€]|usd|доллар|dollar/i;

/**
 * Parse a weight cell into integer grams. Accepts `1,5`, `1.5`, `1 500`,
 * `2 kg`, `2кг`, `800 g` — the shapes that actually appear in cargo files.
 * Returns `null` for blank, zero, non-numeric or absurd values.
 */
export function parseImportWeight(raw: string): number | null {
  let s = raw.trim();
  if (s === '') return null;

  let unit: 'kg' | 'g' = 'kg';
  // kg first: the `g` suffix would otherwise eat the `g` of `kg`.
  if (KG_SUFFIX.test(s)) s = s.replace(KG_SUFFIX, '');
  else if (GRAM_SUFFIX.test(s)) {
    unit = 'g';
    s = s.replace(GRAM_SUFFIX, '');
  }

  s = s.replace(SOFT_SPACE, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  const grams = unit === 'g' ? Math.round(n) : Math.round(n * 1000);
  if (grams <= 0 || grams > MAX_GRAMS) return null;
  return grams;
}

/**
 * Parse a price cell (so'm) into integer tiyin. Handles the separator zoo:
 * `150000`, `150 000`, `150.000`, `150,000` → 150 000 so'm;
 * `1 500,50` / `1.500,50` → 1 500,50 so'm.
 *
 * Rule for the last separator: 1–2 trailing digits mean a decimal fraction,
 * anything else means thousands grouping. A `$` amount is REFUSED rather than
 * guessed — the panel's manual price is always so'm (§7.4), and silently
 * storing dollars as so'm would corrupt every debt on the file.
 */
export function parseImportPrice(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (USD_MARK.test(trimmed)) return null;

  const s = trimmed.replace(SOM_NOISE, '').replace(SOFT_SPACE, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let whole = s;
  let frac = '';
  if (lastSep >= 0) {
    const tail = s.slice(lastSep + 1);
    if (/^\d{1,2}$/.test(tail)) {
      whole = s.slice(0, lastSep);
      frac = tail;
    }
  }
  whole = whole.replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;

  const som = Number(whole);
  const tiyin = som * 100 + Number(frac.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(tiyin) || tiyin <= 0 || tiyin > MAX_PRICE_TIYIN) {
    return null;
  }
  return tiyin;
}

/**
 * A cell that means "nothing here": blank, or a bare zero an admin typed as a
 * placeholder. Used to decide whether an unparseable cell is worth reporting.
 */
export function isBlankCell(raw: string): boolean {
  const s = raw.trim().replace(SOFT_SPACE, '').replace(',', '.');
  return s === '' || s === '-' || s === '—' || /^0+(\.0+)?$/.test(s);
}

// --- Customer reference ----------------------------------------------------

/**
 * Lookup keys for one owner cell, tried by the resolver in this order:
 * client_code → phone → full name (the order the admin chose in setup).
 * A key is `null` when the cell cannot be that kind of reference.
 */
export interface CustomerRefKeys {
  /** The cell as typed — the map key the caller looks resolutions up by. */
  raw: string;
  /** `DK-1042` → `DK1042`; compared against the same stripping of client_code. */
  codeKey: string | null;
  /** Last 9 digits (§7.12), so `+998 90 123-45-67` finds `901234567`. */
  phoneKey: string | null;
  /** Lower-cased, whitespace-collapsed full name. */
  nameKey: string | null;
}

/** `DK-1042`, `dk1042`, `SRV 205` — letters then digits, one optional separator. */
const CLIENT_CODE_SHAPE = /^[a-z]{1,8}[\s-]?\d{1,12}$/i;
/** Enough digits to be a phone number rather than a house number. */
const MIN_PHONE_DIGITS = 7;

/** Strip a client code to its comparable form: upper-case alphanumerics only. */
export function clientCodeKey(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Lower-case + collapse whitespace, so `  Alisher   Valiyev ` matches. */
export function customerNameKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Classify an owner cell into the keys we can look it up by. Returns `null` for
 * a blank cell. A cell can carry several keys at once (`Alisher +998901234567`
 * is both a name and a phone) — the resolver decides by priority.
 */
export function customerRefKeys(raw: string): CustomerRefKeys | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const isCode = CLIENT_CODE_SHAPE.test(trimmed);
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  const hasLetters = /\p{L}/u.test(trimmed);

  return {
    raw: trimmed,
    codeKey: isCode ? clientCodeKey(trimmed) : null,
    phoneKey:
      !isCode && digitCount >= MIN_PHONE_DIGITS
        ? normalizePhone(trimmed)
        : null,
    nameKey: !isCode && hasLetters ? customerNameKey(trimmed) : null,
  };
}

// --- Header detection ------------------------------------------------------

/**
 * Header keywords per field, uz / ru / en. Matched as substrings on a
 * lower-cased header cell, so `Vazn (kg)` and `Вес, кг` both land on `weight`.
 *
 * Order matters: `customer` is tested before `code` because a client-code
 * column is usually called "Mijoz kodi", which also contains "kod".
 */
const HEADER_KEYWORDS: Record<ImportField, readonly string[]> = {
  customer: [
    'mijoz',
    'mijozning',
    'klient',
    'клиент',
    'заказчик',
    'получатель',
    'customer',
    'client',
    'ism',
    'f.i.o',
    'fio',
    'фио',
    'имя',
    'name',
    'telefon',
    'тел',
    'phone',
    'raqam',
  ],
  weight: ['kg', 'кг', 'vazn', 'ogirlik', "og'irlik", 'вес', 'weight', 'massa'],
  price: [
    'narx',
    'summa',
    'сумма',
    'цена',
    'стоимость',
    'price',
    'amount',
    'to‘lov',
    "to'lov",
    'tolov',
    'hisob',
  ],
  code: [
    'trek',
    'трек',
    'track',
    'kod',
    'код',
    'code',
    'nomer',
    'номер',
    'shtrix',
    'штрих',
    'посылк',
    'yuk',
  ],
  description: [
    'tavsif',
    'описание',
    'наименование',
    'товар',
    'tovar',
    'mahsulot',
    'description',
    'item',
    'product',
    'goods',
  ],
};

/**
 * Field priority when scanning headers — most specific label first.
 * `description` goes before `customer`: an English "Item name" / "Product
 * name" header contains customer's `name` keyword and would be claimed as an
 * owner column otherwise.
 */
const DETECT_ORDER: readonly ImportField[] = [
  'weight',
  'price',
  'description',
  'customer',
  'code',
];

function matchesField(header: string, field: ImportField): boolean {
  const h = header.trim().toLowerCase();
  if (h === '') return false;
  return HEADER_KEYWORDS[field].some((kw) => h.includes(kw));
}

/**
 * Does this cell look like a track code *by itself*? Stricter than
 * {@link isValidTrackCode}: a real code always carries a digit, while plenty of
 * prose passes the bare 8–20 rule — the header `Trek kodi` normalizes to
 * `TREKKODI` (8 chars) and a name column is full of `ALISHERVALIYEV`. The strict
 * rule is used only for GUESSING; a column the admin maps by hand is read with
 * the plain §7.1 rule.
 */
function looksLikeCodeCell(raw: string): boolean {
  const normalized = normalizeCode(raw);
  return isValidTrackCode(normalized) && /\d/.test(normalized);
}

/** How many cells of this column look like track codes. */
function codeHitCount(
  rows: readonly (readonly string[])[],
  col: number,
): number {
  let hits = 0;
  for (const row of rows) {
    const cell = row[col];
    if (!cell) continue;
    if (looksLikeCodeCell(cell)) hits++;
  }
  return hits;
}

export interface DetectedLayout {
  /** True when row 0 looks like labels rather than data. */
  hasHeader: boolean;
  /** Best-guess mapping, or `null` when no column holds track codes at all. */
  mapping: ColumnMapping | null;
  /** Widest row in the grid — how many selects the mapping UI must render. */
  columnCount: number;
}

/**
 * Guess the layout of a grid: is the first row a header, and which column is
 * which. Headers are matched by keyword; the code column additionally falls
 * back to "the column with the most cells that parse as track codes", which is
 * what makes header-less files (and files with a header we don't recognise)
 * work anyway.
 */
export function detectImportLayout(
  rows: readonly (readonly string[])[],
): DetectedLayout {
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  if (columnCount === 0) {
    return { hasHeader: false, mapping: null, columnCount: 0 };
  }

  const first = rows[0] ?? [];
  // A header row carries labels, not cargo: no cell of it looks like a code,
  // and either we recognise a label or the rows below it clearly hold data
  // (which is how a header written in words we don't know is still detected).
  const firstHasCode = first.some((cell) => cell && looksLikeCodeCell(cell));
  const firstHasLabel = first.some((cell) =>
    IMPORT_FIELDS.some((f) => matchesField(cell ?? '', f)),
  );
  const restHasCode = rows
    .slice(1)
    .some((row) => row.some((cell) => cell && looksLikeCodeCell(cell)));
  const hasHeader = !firstHasCode && (firstHasLabel || restHasCode);

  const taken = new Set<number>();
  const found: Partial<Record<ImportField, number>> = {};
  if (hasHeader) {
    for (const field of DETECT_ORDER) {
      for (let col = 0; col < columnCount; col++) {
        if (taken.has(col)) continue;
        if (!matchesField(first[col] ?? '', field)) continue;
        found[field] = col;
        taken.add(col);
        break;
      }
    }
  }

  // The code column is the one thing we refuse to leave to a label: verify it
  // against the data, and pick the best column when the header didn't say.
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const headerCode = found.code;
  if (headerCode == null || codeHitCount(dataRows, headerCode) === 0) {
    let bestCol = -1;
    let bestHits = 0;
    for (let col = 0; col < columnCount; col++) {
      const hits = codeHitCount(dataRows, col);
      if (hits > bestHits) {
        bestHits = hits;
        bestCol = col;
      }
    }
    if (bestCol < 0) return { hasHeader, mapping: null, columnCount };
    // Give the code column back if a weaker guess had claimed it.
    for (const field of IMPORT_FIELDS) {
      if (field !== 'code' && found[field] === bestCol) delete found[field];
    }
    found.code = bestCol;
  }

  return {
    hasHeader,
    mapping: {
      code: found.code!,
      customer: found.customer ?? null,
      weight: found.weight ?? null,
      price: found.price ?? null,
      description: found.description ?? null,
    },
    columnCount,
  };
}

// --- Row classification ----------------------------------------------------

/** A source cell that was filled in but could not be read. */
export interface CellWarning {
  /** 1-based row number in the source file, header included. */
  line: number;
  field: Exclude<ImportField, 'code'>;
  value: string;
}

/** A source row rejected outright: its code column is missing or malformed. */
export interface MalformedRow {
  line: number;
  /** The code cell as typed (or the whole row when the cell is empty). */
  text: string;
}

/** One accepted row, ready for the tenant-scoped lookups the web layer does. */
export interface MappedImportRow {
  line: number;
  /** Trimmed as-entered code → `code_original`. */
  original: string;
  /** Normalized code (§7.1) → `code_normalized`, the upsert key. */
  normalized: string;
  /** Owner cell, already classified into lookup keys; `null` when unmapped. */
  customerRef: CustomerRefKeys | null;
  weightGrams: number | null;
  /** Agreed price from the file, in tiyin → a manual override (§7.4). */
  priceTiyin: number | null;
  /** Goods description as typed, or `null` when unmapped/blank (§7.13). */
  description: string | null;
}

export interface MappedParseResult {
  rows: MappedImportRow[];
  malformed: MalformedRow[];
  /** Rows dropped because an earlier row carried the same normalized code. */
  duplicateCount: number;
  /** Non-blank kg/price cells that could not be parsed — imported without them. */
  warnings: CellWarning[];
}

function cell(row: readonly string[], col: number | null): string {
  if (col == null) return '';
  return (row[col] ?? '').trim();
}

/**
 * Turn a grid into import rows under a mapping.
 *
 * A row is rejected only when its CODE is unusable — a bad kg or price cell is
 * a warning, not a rejection: the parcel still has to enter the system, and an
 * admin fixes one weight afterwards far more easily than they re-cut a file.
 * Within-file duplicates are dropped, first occurrence wins (§7.2 upsert key).
 */
export function classifyMappedRows(
  grid: readonly (readonly string[])[],
  mapping: ColumnMapping,
  hasHeader: boolean,
): MappedParseResult {
  const rows: MappedImportRow[] = [];
  const malformed: MalformedRow[] = [];
  const warnings: CellWarning[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (let i = hasHeader ? 1 : 0; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const line = i + 1; // 1-based, as the spreadsheet shows it
    if (row.every((c) => (c ?? '').trim() === '')) continue;

    const codeCell = cell(row, mapping.code);
    const normalized = normalizeCode(codeCell);
    if (!isValidTrackCode(normalized)) {
      malformed.push({
        line,
        text: codeCell || row.find((c) => (c ?? '').trim() !== '') || '',
      });
      continue;
    }
    if (seen.has(normalized)) {
      duplicateCount++;
      continue;
    }
    seen.add(normalized);

    const weightCell = cell(row, mapping.weight);
    const weightGrams = parseImportWeight(weightCell);
    if (weightGrams == null && !isBlankCell(weightCell)) {
      warnings.push({ line, field: 'weight', value: weightCell });
    }

    const priceCell = cell(row, mapping.price);
    const priceTiyin = parseImportPrice(priceCell);
    if (priceTiyin == null && !isBlankCell(priceCell)) {
      warnings.push({ line, field: 'price', value: priceCell });
    }

    const descriptionCell = cell(row, mapping.description);

    rows.push({
      line,
      original: codeCell,
      normalized,
      customerRef: customerRefKeys(cell(row, mapping.customer)),
      weightGrams,
      priceTiyin,
      // Free text — anything non-blank counts, there is nothing to mis-parse.
      description: isBlankCell(descriptionCell) ? null : descriptionCell,
    });
  }

  return { rows, malformed, duplicateCount, warnings };
}

// --- Pricing plan ----------------------------------------------------------

/** The price-carrying columns of `tracks`, as an import decides to fill them. */
export interface ImportPriceFields {
  weightGrams: number | null;
  priceTiyin: number | null;
  priceUsdCents: number | null;
  usdRateUsed: number | null;
  tariffId: string | null;
  priceManual: boolean;
  /** Frozen volumetric weight when the target parcel was measured (§7.16). */
  volumetricGrams: number | null;
}

export interface ImportPricingContext {
  currency: Currency;
  /** Som per 1 USD in tiyin; required when `currency` is 'USD'. */
  usdRateTiyin: number | null;
  /** The tenant's default tariff, or `null` when none is configured. */
  tariff: {
    id: string;
    pricePerKgMinor: number;
    /** kg per m³ (§7.16); absent/null disables volumetric pricing. */
    volumetricCoef?: number | null;
  } | null;
}

/**
 * Decide what an imported row writes into the pricing columns (§7.4).
 *
 * - A price in the file wins and is stored as a MANUAL price: it is the sum the
 *   company agreed with the customer, not something kg × tariff can reproduce.
 * - Otherwise a weight is priced from the tenant's default tariff, freezing the
 *   USD rate exactly as weighing on the track page does.
 * - Neither present → nothing to write.
 */
export function planImportPricing(
  row: {
    weightGrams: number | null;
    priceTiyin: number | null;
    /**
     * Sides already stored on the parcel this row targets (§7.16). A file never
     * carries dimensions, but a parcel measured at the warehouse must not lose
     * its volumetric price because a weight arrived by import afterwards.
     */
    dimensions?: Dimensions | null;
  },
  ctx: ImportPricingContext,
): ImportPriceFields | null {
  if (row.priceTiyin != null) {
    return {
      weightGrams: row.weightGrams,
      priceTiyin: row.priceTiyin,
      priceUsdCents: null,
      usdRateUsed: null,
      // A tariff is only meaningful next to a weight.
      tariffId: row.weightGrams != null ? (ctx.tariff?.id ?? null) : null,
      priceManual: true,
      volumetricGrams:
        row.weightGrams != null
          ? chargeableWeight(
              row.weightGrams,
              row.dimensions ?? null,
              ctx.tariff?.volumetricCoef ?? null,
            ).volumetricGrams
          : null,
    };
  }

  if (row.weightGrams == null) return null;

  // Weight without a usable tariff still belongs in the system — the warehouse
  // weighed it. The price stays empty until an admin sets a tariff.
  if (!ctx.tariff || (ctx.currency === 'USD' && ctx.usdRateTiyin == null)) {
    return {
      weightGrams: row.weightGrams,
      priceTiyin: null,
      priceUsdCents: null,
      usdRateUsed: null,
      tariffId: ctx.tariff?.id ?? null,
      priceManual: false,
      volumetricGrams: null,
    };
  }

  const charged = chargeableWeight(
    row.weightGrams,
    row.dimensions ?? null,
    ctx.tariff.volumetricCoef ?? null,
  );
  const price = computeTrackPrice({
    weightGrams: charged.grams,
    pricePerKgMinor: ctx.tariff.pricePerKgMinor,
    currency: ctx.currency,
    usdRateTiyin: ctx.usdRateTiyin,
  });
  return {
    // The scale reading the file carried, never the chargeable figure (§7.16).
    weightGrams: row.weightGrams,
    priceTiyin: price.priceTiyin,
    priceUsdCents: price.priceUsdCents,
    usdRateUsed: price.usdRateUsed,
    tariffId: ctx.tariff.id,
    priceManual: false,
    volumetricGrams: charged.volumetricGrams,
  };
}
