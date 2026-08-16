/**
 * Import runs and their undo (SPEC §7.18, tasks.md M — D-010).
 *
 * Pure + framework-free, like every other service here: the shapes below are
 * what `import_runs.items` / `.rejected` hold as jsonb, and the rules are what
 * the panel, the query layer and the tests all agree on.
 *
 * The one idea worth stating once: an undo restores **only what its own run
 * wrote**, and only where nothing has happened since. That is why an item
 * carries both halves — what the run WROTE (to prove nobody changed it) and
 * what stood there BEFORE (to put back).
 */

/** How long after an apply the undo stays available (§7.18, D-010). */
export const IMPORT_UNDO_WINDOW_MINUTES = 60;

/**
 * How long an import's status notifications sit in the queue before the first
 * one leaves (§7.18) — the same hold, and the same number, as a broadcast
 * (§7.11). Without it "the pending ones are stopped" would be a promise the
 * queue drains in seconds: the undo would always arrive after the messages.
 */
export const IMPORT_NOTIFY_HOLD_SECONDS = 60;

/** How many problem rows one run stores for the M3 export. */
export const MAX_REJECTED_ROWS = 1000;

/**
 * Track columns an import can write, and therefore an undo can restore.
 * `deletedAt` is here because §7.2 revives a soft-deleted row on import — that
 * is a write like any other and must be reversible.
 */
export const IMPORT_RUN_FIELDS = [
  'currentStatus',
  'batchId',
  'deletedAt',
  'customerId',
  'weightGrams',
  'priceTiyin',
  'priceUsdCents',
  'usdRateUsed',
  'tariffId',
  'priceManual',
  'marka',
  'description',
  'volumetricGrams',
] as const;

export type ImportRunField = (typeof IMPORT_RUN_FIELDS)[number];

/**
 * A jsonb-safe snapshot of those columns. Timestamps are ISO strings (jsonb has
 * no date type), so the comparison below is scalar equality and nothing else.
 * Only the keys the run actually wrote appear.
 */
export type ImportRunValues = Partial<
  Record<ImportRunField, string | number | boolean | null>
>;

/** One track this run touched. */
export interface ImportRunItem {
  trackId: string;
  /** `created` rows are undone by soft-deleting them; `updated` rows are restored. */
  action: 'created' | 'updated';
  /** What the run wrote. Empty means "nothing to undo" and no item is stored. */
  wrote: ImportRunValues;
  /** What stood in those same columns before. Empty for a created row. */
  prior: ImportRunValues;
}

/** Why a source row could not be used as-is (§7.18, M3). */
export const IMPORT_REJECT_REASONS = [
  /** Track code unusable (§7.1) — the ONLY reason a row is dropped entirely. */
  'badCode',
  /** kg cell present but unreadable; the parcel was imported without a weight. */
  'weight',
  /** Price cell present but unreadable (or a `$` amount — §7.2). */
  'price',
  /** Owner cell nobody matched; the track was imported unattached (§7.2). */
  'customerMissing',
  /** Owner cell several customers answer to — never guessed (§7.12). */
  'customerAmbiguous',
] as const;

export type ImportRejectReason = (typeof IMPORT_REJECT_REASONS)[number];

/** One problem row, kept whole so the office can fix it and re-send the file. */
export interface ImportRejectedRow {
  /** 1-based row number as the spreadsheet shows it. */
  line: number;
  reason: ImportRejectReason;
  /** The cell that caused it (the code, the kg, the owner reference). */
  value: string;
  /** The source row as it arrived, so the export can hand back real columns. */
  cells: string[];
}

/** Whether the undo control is offered, and if not, why (§7.18). */
export type ImportUndoState = 'available' | 'expired' | 'undone';

/** Milliseconds left in the undo window; 0 once it has closed. */
export function importUndoRemainingMs(
  createdAt: Date,
  now: Date = new Date(),
): number {
  const elapsed = now.getTime() - createdAt.getTime();
  return Math.max(0, IMPORT_UNDO_WINDOW_MINUTES * 60_000 - elapsed);
}

/**
 * A run is undoable once, inside its window. `undone_at` is checked first: a
 * run undone at minute 3 must not look "available" again at minute 4 just
 * because time is left.
 */
export function importUndoState(
  run: { createdAt: Date; undoneAt: Date | null },
  now: Date = new Date(),
): ImportUndoState {
  if (run.undoneAt != null) return 'undone';
  return importUndoRemainingMs(run.createdAt, now) > 0 ? 'available' : 'expired';
}

/** What an undo does to one row. */
export type ImportUndoRowPlan =
  | {
      /** Something changed since (or the row is gone) — leave it alone (§7.18). */
      action: 'skip';
    }
  | {
      action: 'revert';
      /** Columns to restore, already narrowed to what this run wrote. */
      set: ImportRunValues;
      /** A row this run created: soft-delete it instead of restoring columns. */
      softDelete: boolean;
    };

/** jsonb round-trips `undefined` to absent; treat both as "no value". */
function same(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Decide what to do with one item, given what the track holds NOW.
 *
 * The rule is deliberately per-ROW, not per-field: if a single value the run
 * wrote has moved since, the whole row is left alone. Half-reverting a parcel
 * that was handed over and paid for at the counter would turn undoing a
 * mistake into a larger one, and "we touched some of it" is not a state
 * anybody can reason about afterwards.
 *
 * `current` is null when the track row cannot be read at all (deleted for real,
 * or another tenant's) — also a skip.
 */
export function planImportUndoRow(
  item: ImportRunItem,
  current: ImportRunValues | null,
): ImportUndoRowPlan {
  if (current == null) return { action: 'skip' };

  for (const key of Object.keys(item.wrote) as ImportRunField[]) {
    if (!same(current[key], item.wrote[key])) return { action: 'skip' };
  }

  if (item.action === 'created') {
    return { action: 'revert', set: {}, softDelete: true };
  }

  // Only the columns this run wrote go back — `prior` was recorded with exactly
  // those keys, so a column the run never touched can never be "restored".
  const set: ImportRunValues = {};
  for (const key of Object.keys(item.wrote) as ImportRunField[]) {
    set[key] = item.prior[key] ?? null;
  }
  return { action: 'revert', set, softDelete: false };
}

/** The counts an undo reports back (§7.18: both numbers, always). */
export interface ImportUndoResult {
  /** Rows put back. */
  reverted: number;
  /** Rows left alone because something changed since. */
  skipped: number;
  /** Notifications this run had already delivered — nothing can recall them. */
  notified: number;
}
