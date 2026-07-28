/**
 * Resolving an import's owner column to customers (SPEC §5.4, §7.12).
 *
 * One cell of a cargo Excel identifies a person in whatever way that company
 * writes it: `DK-1042`, `+998 90 123-45-67`, or `Alisher Valiyev`. The import
 * tries those three in that order — a client code is unambiguous, a phone is
 * the §7.12 identity key, and a name is the last resort because two customers
 * can share one.
 *
 * A name that matches several customers is reported as AMBIGUOUS, never guessed:
 * attaching a parcel (and its debt) to the wrong Alisher is a call to the wrong
 * person and a bill to the wrong person.
 */

import 'server-only';

import { and, eq, inArray, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { customers } from '@kargotrack/db/schema';
import { BULK_CHUNK, chunked, type CustomerRefKeys } from '@kargotrack/shared';

/** How the resolver matched a cell — shown in the preview so the admin can check. */
export type CustomerRefMatchedBy = 'code' | 'phone' | 'name';

export type CustomerRefResolution =
  | {
      status: 'found';
      id: string;
      clientCode: string;
      fullName: string | null;
      matchedBy: CustomerRefMatchedBy;
    }
  /** Several customers answer to this cell — left unattached on purpose. */
  | { status: 'ambiguous'; matchedBy: CustomerRefMatchedBy; count: number }
  /** Nobody in this tenant matches. */
  | { status: 'missing' };

interface CustomerHit {
  id: string;
  clientCode: string;
  fullName: string | null;
  key: string;
}

/** `DK-1042` and `dk1042` are the same code — compare both sides stripped. */
const clientCodeExpr = sql<string>`upper(regexp_replace(${customers.clientCode}, '[^A-Za-z0-9]', '', 'g'))`;
/** Names are compared case-insensitively with collapsed whitespace. */
const fullNameExpr = sql<string>`lower(btrim(regexp_replace(${customers.fullName}, '\\s+', ' ', 'g')))`;

/** Run one keyed lookup in chunks and group the hits by their match key. */
async function lookupBy(
  tenantId: string,
  keyExpr: ReturnType<typeof sql<string>>,
  keys: string[],
): Promise<Map<string, CustomerHit[]>> {
  const byKey = new Map<string, CustomerHit[]>();
  if (keys.length === 0) return byKey;

  const db = getDb();
  for (const chunk of chunked(keys, BULK_CHUNK)) {
    const rows = await db
      .select({
        id: customers.id,
        clientCode: customers.clientCode,
        fullName: customers.fullName,
        key: keyExpr,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), inArray(keyExpr, chunk)));

    for (const row of rows) {
      const list = byKey.get(row.key);
      if (list) list.push(row);
      else byKey.set(row.key, [row]);
    }
  }
  return byKey;
}

function decide(
  hits: CustomerHit[] | undefined,
  matchedBy: CustomerRefMatchedBy,
): CustomerRefResolution | null {
  if (!hits || hits.length === 0) return null;
  if (hits.length > 1) {
    return { status: 'ambiguous', matchedBy, count: hits.length };
  }
  const hit = hits[0]!;
  return {
    status: 'found',
    id: hit.id,
    clientCode: hit.clientCode,
    fullName: hit.fullName,
    matchedBy,
  };
}

/**
 * Resolve every owner cell of an import in three tenant-scoped queries (one per
 * key kind), regardless of how many rows the file has. Returns a map keyed by
 * `CustomerRefKeys.raw` — the cell as typed, which is what the caller holds.
 */
export async function resolveCustomerRefs(
  tenantId: string,
  refs: readonly CustomerRefKeys[],
): Promise<Map<string, CustomerRefResolution>> {
  const out = new Map<string, CustomerRefResolution>();
  if (refs.length === 0) return out;

  const codeKeys = new Set<string>();
  const phoneKeys = new Set<string>();
  const nameKeys = new Set<string>();
  for (const ref of refs) {
    if (ref.codeKey) codeKeys.add(ref.codeKey);
    if (ref.phoneKey) phoneKeys.add(ref.phoneKey);
    if (ref.nameKey) nameKeys.add(ref.nameKey);
  }

  const [byCode, byPhone, byName] = await Promise.all([
    lookupBy(tenantId, clientCodeExpr, [...codeKeys]),
    lookupBy(tenantId, sql<string>`${customers.phoneNormalized}`, [
      ...phoneKeys,
    ]),
    lookupBy(tenantId, fullNameExpr, [...nameKeys]),
  ]);

  for (const ref of refs) {
    if (out.has(ref.raw)) continue;
    const resolved = (ref.codeKey
      ? decide(byCode.get(ref.codeKey), 'code')
      : null) ??
      (ref.phoneKey ? decide(byPhone.get(ref.phoneKey), 'phone') : null) ??
      (ref.nameKey ? decide(byName.get(ref.nameKey), 'name') : null) ?? {
        status: 'missing' as const,
      };
    out.set(ref.raw, resolved);
  }

  return out;
}
