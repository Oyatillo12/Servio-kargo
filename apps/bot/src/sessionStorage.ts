/**
 * Postgres-backed grammY session storage (AUDIT.md T16). The old in-memory
 * session meant every deploy dropped customers out of half-finished flows.
 *
 * grammY reads the session at the start of every update and writes it back at
 * the end whether or not anything changed — naively that is one extra INSERT
 * per update. The adapter skips the write when the serialized value matches
 * what this update just read (`lastSeen` is repopulated by read() on every
 * update, so the comparison is always against fresh data), and never creates
 * a row for the empty `{}` session most updates carry. Single-process cache by
 * design: the webhook server is one container; the worker never touches
 * sessions.
 */

import type { StorageAdapter } from 'grammy';

import type { SessionData } from './context';
import { deleteSession, readSession, writeSession } from './queries';

/** Cache marker for "no row in the database". */
const ABSENT = '';

const lastSeen = new Map<string, string>();
const LAST_SEEN_CAP = 10_000;

function remember(cacheKey: string, json: string): void {
  lastSeen.delete(cacheKey);
  lastSeen.set(cacheKey, json);
  if (lastSeen.size > LAST_SEEN_CAP) {
    const oldest = lastSeen.keys().next().value;
    if (oldest !== undefined) lastSeen.delete(oldest);
  }
}

export function createSessionStorage(
  tenantId: string,
): StorageAdapter<SessionData> {
  const ck = (key: string): string => `${tenantId}:${key}`;

  return {
    async read(key) {
      const data = await readSession(tenantId, key);
      remember(ck(key), data ? JSON.stringify(data) : ABSENT);
      return data as SessionData | undefined;
    },

    async write(key, value) {
      const json = JSON.stringify(value ?? {});
      const cached = lastSeen.get(ck(key));
      if (json === cached) return;
      // An empty session over no row: nothing worth persisting.
      if (json === '{}' && cached === ABSENT) return;
      await writeSession(tenantId, key, value as Record<string, unknown>);
      remember(ck(key), json);
    },

    async delete(key) {
      await deleteSession(tenantId, key);
      remember(ck(key), ABSENT);
    },
  };
}
