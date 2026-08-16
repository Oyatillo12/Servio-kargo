import { describe, expect, it } from 'vitest';

import {
  IMPORT_UNDO_WINDOW_MINUTES,
  importUndoRemainingMs,
  importUndoState,
  planImportUndoRow,
  type ImportRunItem,
  type ImportRunValues,
} from './importRun';

const AT = new Date('2026-08-16T10:00:00.000Z');
const min = (n: number) => new Date(AT.getTime() + n * 60_000);

/** An updated row: the import moved its status and filled a weight. */
const updated: ImportRunItem = {
  trackId: 'trk-1',
  action: 'updated',
  wrote: { currentStatus: 'IN_TRANSIT', weightGrams: 3200 },
  prior: { currentStatus: 'CHINA_WAREHOUSE', weightGrams: null },
};

/** What that track holds now, unchanged since the run. */
const untouched: ImportRunValues = {
  currentStatus: 'IN_TRANSIT',
  weightGrams: 3200,
};

describe('importUndoState (§7.18)', () => {
  const run = { createdAt: AT, undoneAt: null };

  it('is available inside the window', () => {
    expect(importUndoState(run, min(0))).toBe('available');
    expect(importUndoState(run, min(IMPORT_UNDO_WINDOW_MINUTES - 1))).toBe(
      'available',
    );
  });

  it('expires when the window closes', () => {
    expect(importUndoState(run, min(IMPORT_UNDO_WINDOW_MINUTES))).toBe(
      'expired',
    );
    expect(importUndoState(run, min(120))).toBe('expired');
  });

  it('an undone run never looks available again', () => {
    const done = { createdAt: AT, undoneAt: min(3) };
    expect(importUndoState(done, min(4))).toBe('undone');
    expect(importUndoState(done, min(90))).toBe('undone');
  });

  it('counts the window down and floors at zero', () => {
    expect(importUndoRemainingMs(AT, min(0))).toBe(60 * 60_000);
    expect(importUndoRemainingMs(AT, min(59))).toBe(60_000);
    expect(importUndoRemainingMs(AT, min(61))).toBe(0);
  });
});

describe('planImportUndoRow (§7.18) — updated rows', () => {
  it('restores exactly what the run wrote', () => {
    const plan = planImportUndoRow(updated, untouched);
    expect(plan).toEqual({
      action: 'revert',
      softDelete: false,
      set: { currentStatus: 'CHINA_WAREHOUSE', weightGrams: null },
    });
  });

  it('skips the whole row when ONE written value moved since', () => {
    // Handed over at the counter after the import: the weight is still the
    // one the file gave, but reverting the status now would undo real work.
    expect(
      planImportUndoRow(updated, { ...untouched, currentStatus: 'DELIVERED' }),
    ).toEqual({ action: 'skip' });

    // Re-weighed at the warehouse — same reasoning, other column.
    expect(
      planImportUndoRow(updated, { ...untouched, weightGrams: 4100 }),
    ).toEqual({ action: 'skip' });
  });

  it('never touches a column the run did not write', () => {
    const plan = planImportUndoRow(updated, {
      ...untouched,
      // Somebody typed a price by hand afterwards; the run never wrote one, so
      // it is neither compared nor restored.
      priceTiyin: 900_000,
      marka: 'DK-1042',
    });
    expect(plan).toEqual({
      action: 'revert',
      softDelete: false,
      set: { currentStatus: 'CHINA_WAREHOUSE', weightGrams: null },
    });
  });

  it('restores a revived row to soft-deleted (§7.2 revive is a write)', () => {
    const revived: ImportRunItem = {
      trackId: 'trk-2',
      action: 'updated',
      wrote: { currentStatus: 'IN_TRANSIT', deletedAt: null },
      prior: {
        currentStatus: 'CHINA_WAREHOUSE',
        deletedAt: '2026-08-01T09:00:00.000Z',
      },
    };
    expect(
      planImportUndoRow(revived, {
        currentStatus: 'IN_TRANSIT',
        deletedAt: null,
      }),
    ).toEqual({
      action: 'revert',
      softDelete: false,
      set: {
        currentStatus: 'CHINA_WAREHOUSE',
        deletedAt: '2026-08-01T09:00:00.000Z',
      },
    });
  });

  it('restores the previous batch, not "no batch"', () => {
    const moved: ImportRunItem = {
      trackId: 'trk-3',
      action: 'updated',
      wrote: { batchId: 'batch-new' },
      prior: { batchId: 'batch-old' },
    };
    expect(planImportUndoRow(moved, { batchId: 'batch-new' })).toEqual({
      action: 'revert',
      softDelete: false,
      set: { batchId: 'batch-old' },
    });
  });

  it('detaches an owner the run attached', () => {
    const attached: ImportRunItem = {
      trackId: 'trk-4',
      action: 'updated',
      wrote: { customerId: 'cust-7' },
      prior: { customerId: null },
    };
    expect(planImportUndoRow(attached, { customerId: 'cust-7' })).toEqual({
      action: 'revert',
      softDelete: false,
      set: { customerId: null },
    });
    // The customer claimed a different parcel owner in the meantime.
    expect(planImportUndoRow(attached, { customerId: 'cust-9' })).toEqual({
      action: 'skip',
    });
  });

  it('treats a missing key and null as the same absence', () => {
    const item: ImportRunItem = {
      trackId: 'trk-5',
      action: 'updated',
      wrote: { marka: 'DK-1042' },
      prior: {},
    };
    // `prior` never recorded the key: it was empty, so it goes back to null.
    expect(planImportUndoRow(item, { marka: 'DK-1042' })).toEqual({
      action: 'revert',
      softDelete: false,
      set: { marka: null },
    });
  });
});

describe('planImportUndoRow (§7.18) — created rows', () => {
  const created: ImportRunItem = {
    trackId: 'trk-6',
    action: 'created',
    wrote: {
      currentStatus: 'CHINA_WAREHOUSE',
      deletedAt: null,
      customerId: null,
      weightGrams: null,
    },
    prior: {},
  };

  it('soft-deletes a track nobody has touched', () => {
    expect(
      planImportUndoRow(created, {
        currentStatus: 'CHINA_WAREHOUSE',
        deletedAt: null,
        customerId: null,
        weightGrams: null,
      }),
    ).toEqual({ action: 'revert', set: {}, softDelete: true });
  });

  it('keeps a track a customer has since claimed', () => {
    expect(
      planImportUndoRow(created, {
        currentStatus: 'CHINA_WAREHOUSE',
        deletedAt: null,
        customerId: 'cust-3',
        weightGrams: null,
      }),
    ).toEqual({ action: 'skip' });
  });

  it('keeps a track that was weighed after the import', () => {
    expect(
      planImportUndoRow(created, {
        currentStatus: 'CHINA_WAREHOUSE',
        deletedAt: null,
        customerId: null,
        weightGrams: 5000,
      }),
    ).toEqual({ action: 'skip' });
  });

  it('skips a track that is gone', () => {
    expect(planImportUndoRow(created, null)).toEqual({ action: 'skip' });
  });
});
