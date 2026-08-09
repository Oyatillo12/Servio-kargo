/**
 * Fixed-window login throttling (AUDIT.md T9). The one module in `lib/queries`
 * that is deliberately NOT tenant-scoped: it runs before authentication, when
 * no tenant is known — keys are phone numbers and caller IPs, never user data
 * beyond that. Rules and verdicts live in `@kargotrack/shared` (`throttle.ts`).
 */

import 'server-only';

import { sql } from 'drizzle-orm';

import { getDb } from '@kargotrack/db';
import { authThrottle } from '@kargotrack/db/schema';

/**
 * Count one attempt against `key` and return the attempt number within the
 * current window. Atomic — a single upsert, so two racing logins can never
 * lose a count: an expired window resets to 1, a live one increments.
 */
export async function bumpThrottle(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const db = getDb();
  const boundary = sql`now() - make_interval(secs => ${windowSeconds})`;
  const rows = await db
    .insert(authThrottle)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: authThrottle.key,
      set: {
        count: sql`case when ${authThrottle.windowStart} < ${boundary} then 1 else ${authThrottle.count} + 1 end`,
        windowStart: sql`case when ${authThrottle.windowStart} < ${boundary} then now() else ${authThrottle.windowStart} end`,
      },
    })
    .returning({ count: authThrottle.count });
  return rows[0]?.count ?? 1;
}

/** Forget a key after a successful login — honest mistakes don't accumulate. */
export async function clearThrottle(key: string): Promise<void> {
  const db = getDb();
  await db
    .delete(authThrottle)
    .where(sql`${authThrottle.key} = ${key}`);
}
