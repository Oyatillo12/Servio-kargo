import { describe, expect, it } from 'vitest';

import { BULK_CHUNK, chunked } from './bulk';

/** Postgres' hard cap on bind parameters in one statement. */
const PG_PARAM_LIMIT = 65535;

describe('chunked', () => {
  it('returns nothing for an empty input — never an empty statement', () => {
    expect(chunked([])).toEqual([]);
    expect(chunked([], 10)).toEqual([]);
  });

  it('keeps a short list in a single chunk', () => {
    expect(chunked([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('splits an exact multiple without a trailing empty chunk', () => {
    const chunks = chunked([1, 2, 3, 4], 2);
    expect(chunks).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('puts the remainder in the last chunk', () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('loses and reorders nothing', () => {
    const items = Array.from({ length: 2500 }, (_, i) => i);
    expect(chunked(items).flat()).toEqual(items);
  });

  it('rejects a non-positive size instead of looping forever', () => {
    expect(() => chunked([1], 0)).toThrow(/positive integer/);
    expect(() => chunked([1], -1)).toThrow(/positive integer/);
    expect(() => chunked([1], 1.5)).toThrow(/positive integer/);
  });
});

describe('BULK_CHUNK keeps statements under the Postgres parameter cap', () => {
  // 2500 tracks is the AUDIT.md T7 scenario: a full flight ("reys") flipped to
  // IN_TRANSIT in one go.
  const ids = Array.from({ length: 2500 }, (_, i) => `track-${i}`);

  it('splits 2500 ids into whole chunks of at most BULK_CHUNK', () => {
    const chunks = chunked(ids);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(BULK_CHUNK);
  });

  it('leaves headroom for the widest row we bind', () => {
    // `track_events` binds 4 columns per row; the `tracks` insert in applyImport
    // binds 6. Even doubling that stays far under the cap.
    for (const columnsPerRow of [4, 6, 12]) {
      expect(BULK_CHUNK * columnsPerRow).toBeLessThan(PG_PARAM_LIMIT);
    }
  });

  it('bounds an UPDATE ... WHERE id IN (chunk) too', () => {
    // Worst case: every id bound, plus a handful of SET / tenant scoping params.
    const perStatement = BULK_CHUNK + 10;
    expect(perStatement).toBeLessThan(PG_PARAM_LIMIT);
  });
});
