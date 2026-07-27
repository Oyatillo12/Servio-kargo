/**
 * Bulk-write chunking (AUDIT.md T7).
 *
 * Postgres caps a single statement at 65535 bind parameters, so every bulk
 * UPDATE / INSERT and every queue fan-out has to be split. One constant and one
 * helper for all of them — the import path, the panel's bulk status change, the
 * batch propagation and the pg-boss inserts — so they cannot drift apart and
 * quietly grow a statement that only blows up on a big enough import.
 *
 * Pure + framework-free.
 */

/**
 * Rows per bulk INSERT, ids per bulk UPDATE, jobs per queue insert.
 *
 * The widest statement built anywhere binds ~6 columns per row (the `tracks`
 * INSERT in `applyImport`), so a 1000-row chunk spends ~6000 of the 65535
 * parameters. That is an order of magnitude of headroom for columns added
 * later, while still turning 2500 tracks into 3 round trips instead of 2500.
 */
export const BULK_CHUNK = 1000;

/**
 * Split `items` into consecutive chunks of at most `size` (default
 * {@link BULK_CHUNK}). Concatenating the result reproduces the input exactly;
 * an empty input yields no chunks, so callers never issue an empty statement.
 */
export function chunked<T>(
  items: readonly T[],
  size: number = BULK_CHUNK,
): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
