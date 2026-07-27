/**
 * Turning `created_by` into a person (AUDIT.md T8).
 *
 * `track_events.created_by` is a free-form actor string written by three
 * different callers: an `admin_users` uuid from the panel, `staff:<telegram id>`
 * from the bot's weighing mode, `customer:<telegram id>` when the customer
 * registered the code themselves, and the literal `system` for seeds and sweeps.
 * The timeline printed it raw, so the audit trail an owner was supposed to rely
 * on read `a3f7b2c1-9e4d-…` — technically complete and humanly useless.
 *
 * Now that employees carry `tg_user_id`, both the uuid and the `staff:` form
 * resolve to the same row, so a parcel weighed in Guangzhou over Telegram and a
 * status changed from the Tashkent office name the same person.
 */

import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { adminUsers } from '@kargotrack/db/schema';
import { toAdminRole, type AdminRole } from '@kargotrack/shared';

export type ActorRef =
  /** An employee. `name` is null when nobody has filled theirs in yet. */
  | { kind: 'admin'; name: string | null; role: AdminRole; viaBot: boolean }
  /** The customer themselves, via the bot. */
  | { kind: 'customer' }
  /** A seed, migration or scheduled sweep. */
  | { kind: 'system' }
  /** A `staff:<id>` whose employee row is gone, or anything unparseable. */
  | { kind: 'unknown' };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a batch of raw actor strings to people, in two queries regardless of
 * how many events a track has.
 *
 * Returns a map keyed by the raw string, so callers can look up per row without
 * caring how it was parsed. Unknown keys are still present, mapped to
 * `{ kind: 'unknown' }` — the caller never has to handle a missing entry.
 */
export async function resolveActors(
  tenantId: string,
  raw: readonly (string | null)[],
): Promise<Map<string, ActorRef>> {
  const out = new Map<string, ActorRef>();

  const ids = new Set<string>();
  const tgIds = new Set<number>();

  for (const value of raw) {
    if (!value || out.has(value)) continue;
    if (value === 'system') {
      out.set(value, { kind: 'system' });
      continue;
    }
    if (value.startsWith('customer:')) {
      out.set(value, { kind: 'customer' });
      continue;
    }
    if (value.startsWith('staff:')) {
      const tg = Number(value.slice('staff:'.length));
      if (Number.isSafeInteger(tg) && tg > 0) {
        tgIds.add(tg);
        continue; // filled in below, or left unknown
      }
      out.set(value, { kind: 'unknown' });
      continue;
    }
    if (UUID_RE.test(value)) {
      ids.add(value);
      continue;
    }
    out.set(value, { kind: 'unknown' });
  }

  const db = getDb();
  const columns = {
    id: adminUsers.id,
    fullName: adminUsers.fullName,
    phone: adminUsers.phone,
    role: adminUsers.role,
    tgUserId: adminUsers.tgUserId,
  };

  // Both lookups are tenant-scoped (CLAUDE.md rule 1): an actor id that belongs
  // to another company must read as unknown here, not leak a name.
  const [byId, byTg] = await Promise.all([
    ids.size > 0
      ? db
          .select(columns)
          .from(adminUsers)
          .where(
            and(
              eq(adminUsers.tenantId, tenantId),
              inArray(adminUsers.id, [...ids]),
            ),
          )
      : Promise.resolve([]),
    tgIds.size > 0
      ? db
          .select(columns)
          .from(adminUsers)
          .where(
            and(
              eq(adminUsers.tenantId, tenantId),
              inArray(adminUsers.tgUserId, [...tgIds]),
            ),
          )
      : Promise.resolve([]),
  ]);

  for (const row of byId) {
    out.set(row.id, {
      kind: 'admin',
      // Falls back to the phone: a name is optional, but "who" must not be.
      name: row.fullName ?? row.phone,
      role: toAdminRole(row.role),
      viaBot: false,
    });
  }
  for (const row of byTg) {
    out.set(`staff:${row.tgUserId}`, {
      kind: 'admin',
      name: row.fullName ?? row.phone,
      role: toAdminRole(row.role),
      viaBot: true,
    });
  }

  // Anything we tried to resolve and did not find — a deleted row, or an id
  // from before the employee existed.
  for (const value of raw) {
    if (value && !out.has(value)) out.set(value, { kind: 'unknown' });
  }

  return out;
}
