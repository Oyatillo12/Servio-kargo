/**
 * Shared internals for the `lib/queries` modules. Not re-exported by
 * `./index` — these are implementation details, not panel API.
 */

import 'server-only';

/** Rows per bulk INSERT / ids per bulk UPDATE — stays far under the Postgres
 * 65535-bind-parameter cap even with every track column bound. */
export const IMPORT_CHUNK = 1000;

export function chunked<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Postgres unique-violation SQLSTATE, as surfaced by node-postgres. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === '23505'
  );
}
