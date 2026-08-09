/**
 * Persistence for grammY session state (AUDIT.md T16). One row per
 * (tenant, chat); `data` is the serialized `SessionData` from `context.ts`.
 */

import { and, eq, lt, sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { botSessions } from '@kargotrack/db/schema';

export async function readSession(
  tenantId: string,
  key: string,
): Promise<Record<string, unknown> | undefined> {
  const db = getDb();
  const [row] = await db
    .select({ data: botSessions.data })
    .from(botSessions)
    .where(and(eq(botSessions.tenantId, tenantId), eq(botSessions.key, key)))
    .limit(1);
  return row?.data;
}

export async function writeSession(
  tenantId: string,
  key: string,
  data: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  await db
    .insert(botSessions)
    .values({ tenantId, key, data })
    .onConflictDoUpdate({
      target: [botSessions.tenantId, botSessions.key],
      set: { data, updatedAt: sql`now()` },
    });
}

export async function deleteSession(
  tenantId: string,
  key: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(botSessions)
    .where(and(eq(botSessions.tenantId, tenantId), eq(botSessions.key, key)));
}

/** Flow state older than this belongs to a conversation nobody is finishing. */
export const SESSION_MAX_AGE_DAYS = 30;

/** Drop sessions untouched for `maxAgeDays`. Called from the hourly sweep. */
export async function pruneStaleSessions(maxAgeDays: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .delete(botSessions)
    .where(
      lt(
        botSessions.updatedAt,
        sql`now() - make_interval(days => ${maxAgeDays})`,
      ),
    )
    .returning({ key: botSessions.key });
  return rows.length;
}
