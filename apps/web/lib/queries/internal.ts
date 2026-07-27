/**
 * Shared internals for the `lib/queries` modules. Not re-exported by
 * `./index` — these are implementation details, not panel API.
 *
 * Bulk-write chunking used to live here as `IMPORT_CHUNK`; it moved to
 * `@kargotrack/shared` (`BULK_CHUNK`, `chunked`) so the panel writes and the
 * pg-boss fan-out size their statements from one tested constant (AUDIT.md T7).
 */

import 'server-only';

/** Postgres unique-violation SQLSTATE, as surfaced by node-postgres. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === '23505'
  );
}
